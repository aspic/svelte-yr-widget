
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
function noop() { }
const identity = x => x;
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
}

function append(target, node) {
    target.appendChild(node);
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    node.parentNode.removeChild(node);
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_style(node, key, value, important) {
    node.style.setProperty(key, value, important ? 'important' : '');
}
function custom_event(type, detail) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, false, false, detail);
    return e;
}

const active_docs = new Set();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = node.ownerDocument;
    active_docs.add(doc);
    const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
    const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
    if (!current_rules[name]) {
        current_rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ``}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        active_docs.forEach(doc => {
            const stylesheet = doc.__svelte_stylesheet;
            let i = stylesheet.cssRules.length;
            while (i--)
                stylesheet.deleteRule(i);
            doc.__svelte_rules = {};
        });
        active_docs.clear();
    });
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error(`Function called outside component initialization`);
    return current_component;
}
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
let flushing = false;
const seen_callbacks = new Set();
function flush() {
    if (flushing)
        return;
    flushing = true;
    do {
        // first, call beforeUpdate functions
        // and update components
        for (let i = 0; i < dirty_components.length; i += 1) {
            const component = dirty_components[i];
            set_current_component(component);
            update(component.$$);
        }
        dirty_components.length = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    flushing = false;
    seen_callbacks.clear();
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
}
const null_transition = { duration: 0 };
function create_in_transition(node, fn, params) {
    let config = fn(node, params);
    let running = false;
    let animation_name;
    let task;
    let uid = 0;
    function cleanup() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function go() {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        if (css)
            animation_name = create_rule(node, 0, 1, duration, delay, easing, css, uid++);
        tick(0, 1);
        const start_time = now() + delay;
        const end_time = start_time + duration;
        if (task)
            task.abort();
        running = true;
        add_render_callback(() => dispatch(node, true, 'start'));
        task = loop(now => {
            if (running) {
                if (now >= end_time) {
                    tick(1, 0);
                    dispatch(node, true, 'end');
                    cleanup();
                    return running = false;
                }
                if (now >= start_time) {
                    const t = easing((now - start_time) / duration);
                    tick(t, 1 - t);
                }
            }
            return running;
        });
    }
    let started = false;
    return {
        start() {
            if (started)
                return;
            delete_rule(node);
            if (is_function(config)) {
                config = config();
                wait().then(go);
            }
            else {
                go();
            }
        },
        invalidate() {
            started = false;
        },
        end() {
            if (running) {
                cleanup();
                running = false;
            }
        }
    };
}
function create_bidirectional_transition(node, fn, params, intro) {
    let config = fn(node, params);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = program.b - t;
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config();
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
}
function create_component(block) {
    block && block.c();
}
function mount_component(component, target, anchor) {
    const { fragment, on_mount, on_destroy, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    // onMount happens before the initial afterUpdate
    add_render_callback(() => {
        const new_on_destroy = on_mount.map(run).filter(is_function);
        if (on_destroy) {
            on_destroy.push(...new_on_destroy);
        }
        else {
            // Edge case - component was destroyed immediately,
            // most likely as a result of a binding initialising
            run_all(new_on_destroy);
        }
        component.$$.on_mount = [];
    });
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const prop_values = options.props || {};
    const $$ = component.$$ = {
        fragment: null,
        ctx: null,
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        before_update: [],
        after_update: [],
        context: new Map(parent_component ? parent_component.$$.context : []),
        // everything else
        callbacks: blank_object(),
        dirty
    };
    let ready = false;
    $$.ctx = instance
        ? instance(component, prop_values, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if ($$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor);
        flush();
    }
    set_current_component(parent_component);
}
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set() {
        // overridden by instance, if it has props
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.22.2' }, detail)));
}
function append_dev(target, node) {
    dispatch_dev("SvelteDOMInsert", { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev("SvelteDOMInsert", { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev("SvelteDOMRemove", { node });
    detach(node);
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
    else
        dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    dispatch_dev("SvelteDOMSetData", { node: text, data });
    text.data = data;
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error(`'target' is a required option`);
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn(`Component was already destroyed`); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}
function elasticOut(t) {
    return (Math.sin((-13.0 * (t + 1.0) * Math.PI) / 2) * Math.pow(2.0, -10.0 * t) + 1.0);
}
function quintOut(t) {
    return --t * t * t * t * t + 1;
}

function fade(node, { delay = 0, duration = 400, easing = identity }) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        easing,
        css: t => `opacity: ${t * o}`
    };
}
function scale(node, { delay = 0, duration = 400, easing = cubicOut, start = 0, opacity = 0 }) {
    const style = getComputedStyle(node);
    const target_opacity = +style.opacity;
    const transform = style.transform === 'none' ? '' : style.transform;
    const sd = 1 - start;
    const od = target_opacity * (1 - opacity);
    return {
        delay,
        duration,
        easing,
        css: (_t, u) => `
			transform: ${transform} scale(${1 - (sd * u)});
			opacity: ${target_opacity - (od * u)}
		`
    };
}

/* src/Wind.svelte generated by Svelte v3.22.2 */
const file = "src/Wind.svelte";

// (35:0) {:else}
function create_else_block(ctx) {
	let div;

	const block = {
		c: function create() {
			div = element("div");
			attr_dev(div, "class", "svelte-13vivjj");
			add_location(div, file, 35, 4, 776);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block.name,
		type: "else",
		source: "(35:0) {:else}",
		ctx
	});

	return block;
}

// (30:0) {#if degrees}
function create_if_block(ctx) {
	let div;
	let span0;
	let div_transition;
	let t1;
	let span1;
	let t2;
	let t3;
	let current;

	const block = {
		c: function create() {
			div = element("div");
			span0 = element("span");
			span0.textContent = "⟼";
			t1 = space();
			span1 = element("span");
			t2 = text(/*speed*/ ctx[1]);
			t3 = text(" m/s");
			add_location(span0, file, 31, 8, 709);
			set_style(div, "transform", "rotate(" + (full - /*degrees*/ ctx[0]) + "deg)");
			attr_dev(div, "class", "svelte-13vivjj");
			add_location(div, file, 30, 4, 609);
			add_location(span1, file, 33, 4, 739);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
			append_dev(div, span0);
			insert_dev(target, t1, anchor);
			insert_dev(target, span1, anchor);
			append_dev(span1, t2);
			append_dev(span1, t3);
			current = true;
		},
		p: function update(ctx, dirty) {
			if (!current || dirty & /*degrees*/ 1) {
				set_style(div, "transform", "rotate(" + (full - /*degrees*/ ctx[0]) + "deg)");
			}

			if (!current || dirty & /*speed*/ 2) set_data_dev(t2, /*speed*/ ctx[1]);
		},
		i: function intro(local) {
			if (current) return;

			add_render_callback(() => {
				if (!div_transition) div_transition = create_bidirectional_transition(div, /*rotate*/ ctx[2], { duration: 2000 }, true);
				div_transition.run(1);
			});

			current = true;
		},
		o: function outro(local) {
			if (!div_transition) div_transition = create_bidirectional_transition(div, /*rotate*/ ctx[2], { duration: 2000 }, false);
			div_transition.run(0);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
			if (detaching && div_transition) div_transition.end();
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(span1);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(30:0) {#if degrees}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block, create_else_block];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*degrees*/ ctx[0]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

const full = 180;

function instance($$self, $$props, $$invalidate) {
	let { degrees = 0 } = $$props;
	let { speed = 0 } = $$props;

	function rotate(node, { duration }) {
		return {
			duration,
			css: t => {
				const eased = elasticOut(t);
				return `transform: rotate(${(full - degrees) * eased}deg);`;
			}
		};
	}

	const writable_props = ["degrees", "speed"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Wind> was created with unknown prop '${key}'`);
	});

	let { $$slots = {}, $$scope } = $$props;
	validate_slots("Wind", $$slots, []);

	$$self.$set = $$props => {
		if ("degrees" in $$props) $$invalidate(0, degrees = $$props.degrees);
		if ("speed" in $$props) $$invalidate(1, speed = $$props.speed);
	};

	$$self.$capture_state = () => ({ elasticOut, full, degrees, speed, rotate });

	$$self.$inject_state = $$props => {
		if ("degrees" in $$props) $$invalidate(0, degrees = $$props.degrees);
		if ("speed" in $$props) $$invalidate(1, speed = $$props.speed);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [degrees, speed, rotate];
}

class Wind extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, { degrees: 0, speed: 1 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "Wind",
			options,
			id: create_fragment.name
		});
	}

	get degrees() {
		throw new Error("<Wind>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set degrees(value) {
		throw new Error("<Wind>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get speed() {
		throw new Error("<Wind>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set speed(value) {
		throw new Error("<Wind>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const icons = [{"key":"heavyrainandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s11\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(68,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,87) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s11\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig regn og torevêr","desc_nb":"Kraftig regn og torden","desc_en":"Heavy rain and thunder"},{"key":"heavysleetandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s32\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,80) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s32\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig sludd og torevêr","desc_nb":"Kraftig sludd og torden","desc_en":"Heavy sleet and thunder"},{"key":"rainandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s22\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(65,78) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s22\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regn og torevêr","desc_nb":"Regn og torden","desc_en":"Rain and thunder"},{"key":"heavysnowshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s34\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(13,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(69,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(83,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s29d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s34\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s29d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige snøbyer og torevêr","desc_nb":"Kraftige snøbyger og torden","desc_en":"Heavy snow showers and thunder"},{"key":"heavysnowshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s34\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(13,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(69,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(83,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s29n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s34\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s29n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige snøbyer og torevêr","desc_nb":"Kraftige snøbyger og torden","desc_en":"Heavy snow showers and thunder"},{"key":"heavysnow","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s50\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(72,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s50\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig snø","desc_nb":"Kraftig snø","desc_en":"Heavy snow"},{"key":"heavysleetshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s32\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s27d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s32\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s27d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige sluddbyer og torevêr","desc_nb":"Kraftige sluddbyger og torden","desc_en":"Heavy sleet showers and thunder"},{"key":"heavysleetshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s32\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s27n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s32\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s27n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige sluddbyer og torevêr","desc_nb":"Kraftige sluddbyger og torden","desc_en":"Heavy sleet showers and thunder"},{"key":"rainshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s09\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(45,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s05d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s09\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s05d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regnbyer","desc_nb":"Regnbyger","desc_en":"Rain showers"},{"key":"rainshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s09\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(45,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s05n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s09\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s05n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regnbyer","desc_nb":"Regnbyger","desc_en":"Rain showers"},{"key":"fog","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"fog\">\n    <g fill=\"#999999\">\n      <path d=\"M88.7,3H14.3C13.6,3,13,2.3,13,1.5S13.6,0,14.3,0h74.4C89.4,0,90,0.7,90,1.5S89.4,3,88.7,3z\"></path>\n      <path d=\"M75.7,11H1.3C0.6,11,0,10.3,0,9.5S0.6,8,1.3,8h74.4C76.4,8,77,8.7,77,9.5S76.4,11,75.7,11z\"></path>\n      <path d=\"M86.7,19H12.3c-0.7,0-1.3-0.7-1.3-1.5s0.6-1.5,1.3-1.5h74.4c0.7,0,1.3,0.7,1.3,1.5S87.4,19,86.7,19z\"></path>\n    </g>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s15\">\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#fog\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,76) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s15\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Skodde","desc_nb":"Tåke","desc_en":"Fog"},{"key":"heavysleetshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s48\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s43d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s48\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s43d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige sluddbyer","desc_nb":"Kraftige sluddbyger","desc_en":"Heavy sleet showers"},{"key":"heavysleetshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s48\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s43n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s48\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s43n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige sluddbyer","desc_nb":"Kraftige sluddbyger","desc_en":"Heavy sleet showers"},{"key":"cloudy","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s04\">\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s04\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Skya","desc_nb":"Skyet","desc_en":"Cloudy"},{"key":"lightssnowshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s33\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s28d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s33\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s28d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette snøbyer og torevêr","desc_nb":"Lette snøbyger og torden","desc_en":"Lights snow showers and thunder"},{"key":"lightssnowshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s33\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s28n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s33\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s28n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette snøbyer og torevêr","desc_nb":"Lette snøbyger og torden","desc_en":"Lights snow showers and thunder"},{"key":"snowshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s14\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(52,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s21d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s14\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s21d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snøbyer og torevêr","desc_nb":"Snøbyger og torden","desc_en":"Snow showers and thunder"},{"key":"snowshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s14\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(52,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s21n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s14\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s21n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snøbyer og torevêr","desc_nb":"Snøbyger og torden","desc_en":"Snow showers and thunder"},{"key":"lightsnowshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s49\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s44d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s49\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s44d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette snøbyer","desc_nb":"Lette snøbyger","desc_en":"Light snow showers"},{"key":"lightsnowshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s49\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s44n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s49\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s44n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette snøbyer","desc_nb":"Lette snøbyger","desc_en":"Light snow showers"},{"key":"lightrain","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s46\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(56,78) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s46\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett regn","desc_nb":"Lett regn","desc_en":"Light rain"},{"key":"heavysnowandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s34\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(13,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(69,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(83,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s34\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig snø og torevêr","desc_nb":"Kraftig snø og torden","desc_en":"Heavy snow and thunder"},{"key":"heavysleet","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s48\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,80) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,80) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s48\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig sludd","desc_nb":"Kraftig sludd","desc_en":"Heavy sleet"},{"key":"lightsnowandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s33\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s33\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett snø og torevêr","desc_nb":"Lett snø og torden","desc_en":"Light snow and thunder"},{"key":"lightsleet","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s47\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s47\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett sludd","desc_nb":"Lett sludd","desc_en":"Light sleet"},{"key":"rainshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s22\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(65,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s06d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s22\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s06d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regnbyer og torevêr","desc_nb":"Regnbyger og torden","desc_en":"Rain showers and thunder"},{"key":"rainshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s22\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(65,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s06n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s22\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s06n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regnbyer og torevêr","desc_nb":"Regnbyger og torden","desc_en":"Rain showers and thunder"},{"key":"sleetshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s23\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(64,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s20d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s23\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s20d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sluddbyer og torevêr","desc_nb":"Sluddbyger og torden","desc_en":"Sleet showers and thunder"},{"key":"sleetshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s23\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(64,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s20n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s23\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s20n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sluddbyer og torevêr","desc_nb":"Sluddbyger og torden","desc_en":"Sleet showers and thunder"},{"key":"sleetandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s23\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(27,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(50,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(64,80) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s23\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sludd og torevêr","desc_nb":"Sludd og torden","desc_en":"Sleet and thunder"},{"key":"lightssleetshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s31\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s26d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s31\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s26d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette sluddbyer og torevêr","desc_nb":"Lette sluddbyger og torden","desc_en":"Lights sleet showers and thunder"},{"key":"lightssleetshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s31\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s26n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s31\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s26n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette sluddbyer og torevêr","desc_nb":"Lette sluddbyger og torden","desc_en":"Lights sleet showers and thunder"},{"key":"lightsnow","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s49\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s49\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett snø","desc_nb":"Lett snø","desc_en":"Light snow"},{"key":"sleet","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s12\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(46,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,80) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s12\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sludd","desc_nb":"Sludd","desc_en":"Sleet"},{"key":"snowshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s13\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s08d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s13\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s08d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snøbyer","desc_nb":"Snøbyger","desc_en":"Snow showers"},{"key":"snowshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s13\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s08n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s13\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s08n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snøbyer","desc_nb":"Snøbyger","desc_en":"Snow showers"},{"key":"lightsleetshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s47\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s42d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s47\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s42d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette sluddbyer","desc_nb":"Lette sluddbyger","desc_en":"Light sleet showers"},{"key":"lightsleetshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s47\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s42n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s47\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s42n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette sluddbyer","desc_nb":"Lette sluddbyger","desc_en":"Light sleet showers"},{"key":"heavyrainshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s10\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,87) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s41d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s41d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige regnbyer","desc_nb":"Kraftige regnbyger","desc_en":"Heavy rain showers"},{"key":"heavyrainshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s10\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,87) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s41n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s41n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige regnbyer","desc_nb":"Kraftige regnbyger","desc_en":"Heavy rain showers"},{"key":"lightsleetandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s31\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,88) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s31\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett sludd og torevêr","desc_nb":"Lett sludd og torden","desc_en":"Light sleet and thunder"},{"key":"snowandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s14\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(26,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(52,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(66,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s14\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snø og torevêr","desc_nb":"Snø og torden","desc_en":"Snow and thunder"},{"key":"snow","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s13\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,79) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s13\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Snø","desc_nb":"Snø","desc_en":"Snow"},{"key":"heavyrainshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s11\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(68,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,87) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s25d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s11\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s25d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige regnbyer og torevêr","desc_nb":"Kraftige regnbyger og torden","desc_en":"Heavy rain showers and thunder"},{"key":"heavyrainshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s11\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(55,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(68,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(82,87) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s25n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s11\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s25n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige regnbyer og torevêr","desc_nb":"Kraftige regnbyger og torden","desc_en":"Heavy rain showers and thunder"},{"key":"fair_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_43_37_063_063_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(43,37) scale(0.63,0.63)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s02d\">\n    <g mask=\"url(#cloud_43_37_063_063_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(4,9) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(43,37) scale(0.63,0.63)\"></use>\n  </symbol>\n  <use xlink:href=\"#s02d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lettskya","desc_nb":"Lettskyet","desc_en":"Fair"},{"key":"fair_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_43_37_063_063_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(43,37) scale(0.63,0.63)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s02n\">\n    <g mask=\"url(#cloud_43_37_063_063_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,20) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(43,37) scale(0.63,0.63)\"></use>\n  </symbol>\n  <use xlink:href=\"#s02n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lettskya","desc_nb":"Lettskyet","desc_en":"Fair"},{"key":"rain","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s09\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(45,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s09\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Regn","desc_nb":"Regn","desc_en":"Rain"},{"key":"heavysnowshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s50\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(72,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s45d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s50\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s45d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige snøbyer","desc_nb":"Kraftige snøbyger","desc_en":"Heavy snow showers"},{"key":"heavysnowshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s50\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(15,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(29,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(44,79) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,88) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(72,79) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s45n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s50\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s45n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftige snøbyer","desc_nb":"Kraftige snøbyger","desc_en":"Heavy snow showers"},{"key":"partlycloudy_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s04\">\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s03d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s04\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s03d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Delvis skya","desc_nb":"Delvis skyet","desc_en":"Partly cloudy"},{"key":"partlycloudy_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s04\">\n    <use xlink:href=\"#cloud\" fill=\"#dddddd\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s03n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s04\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s03n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Delvis skya","desc_nb":"Delvis skyet","desc_en":"Partly cloudy"},{"key":"lightrainshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s46\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(56,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s40d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s46\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s40d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette regnbyer","desc_nb":"Lette regnbyger","desc_en":"Light rain showers"},{"key":"lightrainshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s46\">\n    <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(56,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s40n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s46\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s40n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette regnbyer","desc_nb":"Lette regnbyger","desc_en":"Light rain showers"},{"key":"clearsky_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s01d\">\n    <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(9,9) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s01d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Klårvêr","desc_nb":"Klarvær","desc_en":"Clear sky"},{"key":"clearsky_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s01n\">\n    <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(20,20) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s01n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Klårvêr","desc_nb":"Klarvær","desc_en":"Clear sky"},{"key":"sleetshowers_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s12\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(46,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s07d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s12\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s07d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sluddbyer","desc_nb":"Sluddbyger","desc_en":"Sleet showers"},{"key":"sleetshowers_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"snowflake\">\n    <path fill=\"#47c0e3\" d=\"M11.68,4.47H8.85L10.27,2A1.35,1.35,0,1,0,7.93.67L6.51,3.12,5.1.67A1.35,1.35,0,0,0,3.26.18,1.35,1.35,0,0,0,2.76,2L4.18,4.47H1.35a1.35,1.35,0,1,0,0,2.7H4.18L2.76,9.62a1.35,1.35,0,0,0,.49,1.84A1.39,1.39,0,0,0,5.1,11L6.51,8.52,7.93,11a1.35,1.35,0,1,0,2.34-1.35L8.85,7.17h2.83a1.35,1.35,0,1,0,0-2.7Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s12\">\n    <use xlink:href=\"#cloud\" fill=\"#b2b2b2\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#snowflake\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(30,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(46,86) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,80) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n  </defs>\n  <symbol id=\"s07n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s12\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s07n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Sluddbyer","desc_nb":"Sluddbyger","desc_en":"Sleet showers"},{"key":"lightrainandthunder","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n  <defs>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s30\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(28,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,78) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s30\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lett regn og torevêr","desc_nb":"Lett regn og torden","desc_en":"Light rain and thunder"},{"key":"lightrainshowersandthunder_day","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s30\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(28,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"sun\">\n    <path class=\"sun-glow\" fill=\"url(#sun-glow-grad)\" d=\"M66.64,47.86,82,41,66.64,34.12l9.84-13.66L59.76,22.22,61.46,5.47l-13.6,9.89L41,0,34.12,15.36,20.46,5.52l1.76,16.72L5.47,20.54l9.89,13.6L0,41l15.36,6.83L5.52,61.54l16.72-1.76L20.54,76.53l13.6-9.89L41,82l6.83-15.36,13.66,9.84L59.78,59.76l16.75,1.69Z\"></path>\n    <path class=\"sun-outer\" fill=\"#ffd348\" d=\"M19.28,53.5a25,25,0,1,0,9.15-34.16A25,25,0,0,0,19.28,53.5Z\"></path>\n    <path class=\"sun-inner\" fill=\"url(#sun-inner-grad)\" d=\"M22.74,51.5a21,21,0,1,0,7.69-28.69A21,21,0,0,0,22.74,51.5Z\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <radialGradient id=\"sun-glow-grad\" cx=\"41\" cy=\"41\" r=\"41\" gradientUnits=\"userSpaceOnUse\">\n      <stop offset=\"54%\" stop-color=\"#d6b849\"/>\n      <stop offset=\"67%\" stop-color=\"#ffce47\"/>\n      <stop offset=\"100%\" stop-color=\"#ffdb73\"/>\n    </radialGradient>\n    <linearGradient id=\"sun-inner-grad\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">\n      <stop offset=\"0%\" stop-color=\"#ffaf22\" />\n      <stop offset=\"100%\" stop-color=\"#f09900\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s24d\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#sun\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(0,2) scale(0.7,0.7)\"></use>\n    </g>\n    <use xlink:href=\"#s30\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s24d\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette regnbyer og torevêr","desc_nb":"Lette regnbyger og torden","desc_en":"Light rain showers and thunder"},{"key":"lightrainshowersandthunder_night","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"lightning\">\n    <polygon fill=\"#ffdd15\" points=\"19.6 23.42 12.74 20.39 15.55 5 5 24.49 12.08 27.51 7.49 45 19.6 23.42\"></polygon>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n  <symbol id=\"s30\">\n    <g mask=\"url(#lightning_37_51_1_1_4)\">\n      <use xlink:href=\"#cloud\" fill=\"#cccccc\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    </g>\n    <use xlink:href=\"#lightning\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(28,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(58,78) scale(1,1)\"></use>\n  </symbol>\n  <symbol id=\"moon\">\n    <path d=\"M28.43,0A28.44,28.44,0,0,1,32.3,14.32,28.61,28.61,0,0,1,3.69,42.93,28.71,28.71,0,0,1,0,42.66,28.59,28.59,0,1,0,28.43,0Z\" fill=\"url(#moon-grad)\"></path>\n  </symbol>\n\n  <defs>\n    <mask id=\"cloud_3_18_1_1_5\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#cloud\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n  </mask>\n    <linearGradient id=\"moon-grad\" x1=\"0%\" y1=\"50%\" x2=\"100%\" y2=\"0%\">\n      <stop offset=\"0%\" stop-color=\"#686e73\" />\n      <stop offset=\"100%\" stop-color=\"#6a7075\" />\n    </linearGradient>\n    <mask id=\"lightning_37_51_1_1_4\">\n    <rect x=\"0\" y=\"0\" width=\"100\" height=\"100\" fill=\"white\"></rect>\n    <use xlink:href=\"#lightning\" fill=\"black\" stroke=\"black\" stroke-linejoin=\"round\" stroke-width=\"8\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(37,51) scale(1,1)\"></use>\n  </mask>\n  </defs>\n  <symbol id=\"s24n\">\n    <g mask=\"url(#cloud_3_18_1_1_5)\">\n      <use xlink:href=\"#moon\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(2,5) scale(0.714285714,0.714285714)\"></use>\n    </g>\n    <use xlink:href=\"#s30\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n  </symbol>\n  <use xlink:href=\"#s24n\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Lette regnbyer og torevêr","desc_nb":"Lette regnbyger og torden","desc_en":"Light rain showers and thunder"},{"key":"heavyrain","svg":"<svg x=\"0\" y=\"0\" viewBox=\"0 0 100 100\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <symbol id=\"raindrop\">\n    <path fill=\"#0062bf\" d=\"M2.5,13A2.5,2.5,0,0,1,.21,9.51l3.55-8a2.5,2.5,0,0,1,4.57,2l-3.55,8A2.5,2.5,0,0,1,2.5,13Z\"></path>\n  </symbol>\n  <symbol id=\"cloud\">\n    <path d=\"M55.7,5A23.94,23.94,0,0,0,34.37,18.05a9.9,9.9,0,0,0-12.78,5.56,15,15,0,0,0-1.71-.1A14.81,14.81,0,0,0,9.2,28,14.63,14.63,0,0,0,5,38.17v.21A14.83,14.83,0,0,0,19.88,53.06H75.59a14.3,14.3,0,0,0,3.67-28.14A23.93,23.93,0,0,0,55.7,5Z\"></path>\n    <image x=\"5\" y=\"14\" width=\"85\" height=\"43\" xlink:href=\"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFYAAAAkCAMAAAAkYj0PAAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAVUExURSgoKExpcaCgoFBQUG5ublBQUISEhI1fsT0AAAAHdFJOUxsACBsPFRpGXuFgAAABWElEQVRIx7XV25bDIAgF0BMu/v8nF/E+iWlqHNKVN3cpIMXxL4GFM3SQfTazkUyxk63oLYwlVSy2silXkS/wUrZS2a3ZCn1zsdSw7UUYijuHsTa1IvfwWrbSXLkc4N9r27JViwmM1UtWXA3hohQ41m6vl8FQZi7wu2z7KXPW4uRiZS+2AmdXN7DdQEQWQHYHlt6z0dXBBa2xeeVktiZc1jDoF5eGkI4d4MjKc7cNbZ3bqjocLLx5oPDYTaIftcfvAvcs2GFxVsJTOP1wO1jGdUSLaz/DWA1Tl45+Tkqul2ArcPzayGq8JafOUffP3TUp6JQs+Rptc6vtmtBkUw+dv0NzWG0PYf8O7Ym09+ITXyXOPZqEX95aFe3PKxRsL2XV3HR+ZALirPSF0ceHp6F51WBv1A22VaW2GHWzWvat8LOAPf4CrjrA+neNK7+PQBf/DmmLrId09/QDWyESBsibwBUAAAAASUVORK5CYII=\"></image>\n  </symbol>\n\n\n  <symbol id=\"s10\">\n    <use xlink:href=\"#cloud\" fill=\"#999999\" x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(3,18) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(18,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(32,87) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(47,79) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(60,78) scale(1,1)\"></use>\n    <use xlink:href=\"#raindrop\"  x=\"0\" y=\"0\" width=\"100\" height=\"100\" transform=\"translate(74,87) scale(1,1)\"></use>\n  </symbol>\n  <use xlink:href=\"#s10\" x=\"0\" y=\"0\" width=\"100\" height=\"100\"></use>\n</svg>","desc_nn":"Kraftig regn","desc_nb":"Kraftig regn","desc_en":"Heavy rain"}];

/* src/WeatherSymbol.svelte generated by Svelte v3.22.2 */
const file$1 = "src/WeatherSymbol.svelte";

// (44:0) {:else}
function create_else_block$1(ctx) {
	let div;

	const block = {
		c: function create() {
			div = element("div");
			add_location(div, file$1, 44, 4, 1129);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$1.name,
		type: "else",
		source: "(44:0) {:else}",
		ctx
	});

	return block;
}

// (39:0) {#if icon}
function create_if_block$1(ctx) {
	let div1;
	let div0;
	let div0_intro;
	let t0;
	let span;
	let t1;

	const block = {
		c: function create() {
			div1 = element("div");
			div0 = element("div");
			t0 = space();
			span = element("span");
			t1 = text(/*description*/ ctx[1]);
			attr_dev(div0, "class", "icon svelte-1avkmjo");
			add_location(div0, file$1, 40, 8, 985);
			add_location(span, file$1, 41, 8, 1079);
			attr_dev(div1, "class", "container svelte-1avkmjo");
			add_location(div1, file$1, 39, 4, 953);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div1, anchor);
			append_dev(div1, div0);
			div0.innerHTML = /*icon*/ ctx[0];
			append_dev(div1, t0);
			append_dev(div1, span);
			append_dev(span, t1);
		},
		p: function update(ctx, dirty) {
			if (dirty & /*icon*/ 1) div0.innerHTML = /*icon*/ ctx[0];			if (dirty & /*description*/ 2) set_data_dev(t1, /*description*/ ctx[1]);
		},
		i: function intro(local) {
			if (!div0_intro) {
				add_render_callback(() => {
					div0_intro = create_in_transition(div0, scale, { duration: 800, easing: elasticOut });
					div0_intro.start();
				});
			}
		},
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div1);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$1.name,
		type: "if",
		source: "(39:0) {#if icon}",
		ctx
	});

	return block;
}

function create_fragment$1(ctx) {
	let if_block_anchor;

	function select_block_type(ctx, dirty) {
		if (/*icon*/ ctx[0]) return create_if_block$1;
		return create_else_block$1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					transition_in(if_block, 1);
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			}
		},
		i: function intro(local) {
			transition_in(if_block);
		},
		o: noop,
		d: function destroy(detaching) {
			if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$1.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$1($$self, $$props, $$invalidate) {
	let { symbolCode } = $$props, { locale = undefined } = $$props;
	let icon = undefined;
	let description = undefined;

	const localeToDescription = {
		"nn_NO": "desc_nn",
		"nb_NO": "desc_nb",
		"en_GB": "desc_en"
	};

	let selectedLocale = localeToDescription[locale]
	? localeToDescription[locale]
	: localeToDescription["en_GB"];

	const symbols = icons.filter(i => i.key === symbolCode);

	if (symbols.length > 0) {
		const weatherSymbol = symbols.shift();
		icon = weatherSymbol.svg;
		description = weatherSymbol[selectedLocale];
	}

	const writable_props = ["symbolCode", "locale"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<WeatherSymbol> was created with unknown prop '${key}'`);
	});

	let { $$slots = {}, $$scope } = $$props;
	validate_slots("WeatherSymbol", $$slots, []);

	$$self.$set = $$props => {
		if ("symbolCode" in $$props) $$invalidate(2, symbolCode = $$props.symbolCode);
		if ("locale" in $$props) $$invalidate(3, locale = $$props.locale);
	};

	$$self.$capture_state = () => ({
		icons,
		elasticOut,
		scale,
		symbolCode,
		locale,
		icon,
		description,
		localeToDescription,
		selectedLocale,
		symbols
	});

	$$self.$inject_state = $$props => {
		if ("symbolCode" in $$props) $$invalidate(2, symbolCode = $$props.symbolCode);
		if ("locale" in $$props) $$invalidate(3, locale = $$props.locale);
		if ("icon" in $$props) $$invalidate(0, icon = $$props.icon);
		if ("description" in $$props) $$invalidate(1, description = $$props.description);
		if ("selectedLocale" in $$props) selectedLocale = $$props.selectedLocale;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [icon, description, symbolCode, locale];
}

class WeatherSymbol extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$1, create_fragment$1, safe_not_equal, { symbolCode: 2, locale: 3 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "WeatherSymbol",
			options,
			id: create_fragment$1.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*symbolCode*/ ctx[2] === undefined && !("symbolCode" in props)) {
			console.warn("<WeatherSymbol> was created without expected prop 'symbolCode'");
		}
	}

	get symbolCode() {
		throw new Error("<WeatherSymbol>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set symbolCode(value) {
		throw new Error("<WeatherSymbol>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get locale() {
		throw new Error("<WeatherSymbol>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set locale(value) {
		throw new Error("<WeatherSymbol>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

/* src/YrWidget.svelte generated by Svelte v3.22.2 */
const file$2 = "src/YrWidget.svelte";

// (54:0) {:else}
function create_else_block$2(ctx) {
	let div;

	const block = {
		c: function create() {
			div = element("div");
			attr_dev(div, "class", "container svelte-egen9r");
			add_location(div, file$2, 54, 1, 1380);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div, anchor);
		},
		p: noop,
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (detaching) detach_dev(div);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_else_block$2.name,
		type: "else",
		source: "(54:0) {:else}",
		ctx
	});

	return block;
}

// (42:0) {#if weatherSymbol}
function create_if_block$2(ctx) {
	let div3;
	let div0;
	let t0;
	let div1;
	let span;
	let t1;
	let t2;
	let t3;
	let div2;
	let div3_transition;
	let current;

	const weathersymbol = new WeatherSymbol({
			props: {
				symbolCode: /*weatherSymbol*/ ctx[4],
				locale: /*locale*/ ctx[0]
			},
			$$inline: true
		});

	const wind = new Wind({
			props: {
				degrees: /*windDirection*/ ctx[2],
				speed: /*windSpeed*/ ctx[3]
			},
			$$inline: true
		});

	const block = {
		c: function create() {
			div3 = element("div");
			div0 = element("div");
			create_component(weathersymbol.$$.fragment);
			t0 = space();
			div1 = element("div");
			span = element("span");
			t1 = text(/*temp*/ ctx[1]);
			t2 = text("℃");
			t3 = space();
			div2 = element("div");
			create_component(wind.$$.fragment);
			attr_dev(div0, "class", "text svelte-egen9r");
			add_location(div0, file$2, 43, 3, 1125);
			add_location(span, file$2, 47, 4, 1245);
			attr_dev(div1, "class", "text svelte-egen9r");
			add_location(div1, file$2, 46, 3, 1222);
			attr_dev(div2, "class", "text svelte-egen9r");
			add_location(div2, file$2, 49, 3, 1279);
			attr_dev(div3, "class", "container svelte-egen9r");
			add_location(div3, file$2, 42, 1, 1060);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div3, anchor);
			append_dev(div3, div0);
			mount_component(weathersymbol, div0, null);
			append_dev(div3, t0);
			append_dev(div3, div1);
			append_dev(div1, span);
			append_dev(span, t1);
			append_dev(span, t2);
			append_dev(div3, t3);
			append_dev(div3, div2);
			mount_component(wind, div2, null);
			current = true;
		},
		p: function update(ctx, dirty) {
			const weathersymbol_changes = {};
			if (dirty & /*weatherSymbol*/ 16) weathersymbol_changes.symbolCode = /*weatherSymbol*/ ctx[4];
			if (dirty & /*locale*/ 1) weathersymbol_changes.locale = /*locale*/ ctx[0];
			weathersymbol.$set(weathersymbol_changes);
			if (!current || dirty & /*temp*/ 2) set_data_dev(t1, /*temp*/ ctx[1]);
			const wind_changes = {};
			if (dirty & /*windDirection*/ 4) wind_changes.degrees = /*windDirection*/ ctx[2];
			if (dirty & /*windSpeed*/ 8) wind_changes.speed = /*windSpeed*/ ctx[3];
			wind.$set(wind_changes);
		},
		i: function intro(local) {
			if (current) return;
			transition_in(weathersymbol.$$.fragment, local);
			transition_in(wind.$$.fragment, local);

			add_render_callback(() => {
				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, fade, { duration: 1000 }, true);
				div3_transition.run(1);
			});

			current = true;
		},
		o: function outro(local) {
			transition_out(weathersymbol.$$.fragment, local);
			transition_out(wind.$$.fragment, local);
			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, fade, { duration: 1000 }, false);
			div3_transition.run(0);
			current = false;
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div3);
			destroy_component(weathersymbol);
			destroy_component(wind);
			if (detaching && div3_transition) div3_transition.end();
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block$2.name,
		type: "if",
		source: "(42:0) {#if weatherSymbol}",
		ctx
	});

	return block;
}

function create_fragment$2(ctx) {
	let current_block_type_index;
	let if_block;
	let if_block_anchor;
	let current;
	const if_block_creators = [create_if_block$2, create_else_block$2];
	const if_blocks = [];

	function select_block_type(ctx, dirty) {
		if (/*weatherSymbol*/ ctx[4]) return 0;
		return 1;
	}

	current_block_type_index = select_block_type(ctx);
	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

	const block = {
		c: function create() {
			if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if_blocks[current_block_type_index].m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
			current = true;
		},
		p: function update(ctx, [dirty]) {
			let previous_block_index = current_block_type_index;
			current_block_type_index = select_block_type(ctx);

			if (current_block_type_index === previous_block_index) {
				if_blocks[current_block_type_index].p(ctx, dirty);
			} else {
				group_outros();

				transition_out(if_blocks[previous_block_index], 1, 1, () => {
					if_blocks[previous_block_index] = null;
				});

				check_outros();
				if_block = if_blocks[current_block_type_index];

				if (!if_block) {
					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
					if_block.c();
				}

				transition_in(if_block, 1);
				if_block.m(if_block_anchor.parentNode, if_block_anchor);
			}
		},
		i: function intro(local) {
			if (current) return;
			transition_in(if_block);
			current = true;
		},
		o: function outro(local) {
			transition_out(if_block);
			current = false;
		},
		d: function destroy(detaching) {
			if_blocks[current_block_type_index].d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment$2.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function instance$2($$self, $$props, $$invalidate) {
	let { lat } = $$props, { lon } = $$props, { locale } = $$props;
	let temp, windDirection, windSpeed, weatherSymbol = undefined;

	onMount(async () => {
		const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/?lat=${lat}&lon=${lon}`);
		const { properties: { timeseries } } = await response.json();
		const { data: timeSeriesItem } = timeseries.shift();
		const { next_1_hours: { summary: { symbol_code } } } = timeSeriesItem;
		const { instant: { details: { air_temperature, wind_from_direction, wind_speed } } } = timeSeriesItem;
		$$invalidate(4, weatherSymbol = symbol_code);
		$$invalidate(1, temp = air_temperature);
		$$invalidate(2, windDirection = wind_from_direction);
		$$invalidate(3, windSpeed = wind_speed);
	});

	const writable_props = ["lat", "lon", "locale"];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<YrWidget> was created with unknown prop '${key}'`);
	});

	let { $$slots = {}, $$scope } = $$props;
	validate_slots("YrWidget", $$slots, []);

	$$self.$set = $$props => {
		if ("lat" in $$props) $$invalidate(5, lat = $$props.lat);
		if ("lon" in $$props) $$invalidate(6, lon = $$props.lon);
		if ("locale" in $$props) $$invalidate(0, locale = $$props.locale);
	};

	$$self.$capture_state = () => ({
		onMount,
		fade,
		quintOut,
		Wind,
		WeatherSymbol,
		lat,
		lon,
		locale,
		temp,
		windDirection,
		windSpeed,
		weatherSymbol
	});

	$$self.$inject_state = $$props => {
		if ("lat" in $$props) $$invalidate(5, lat = $$props.lat);
		if ("lon" in $$props) $$invalidate(6, lon = $$props.lon);
		if ("locale" in $$props) $$invalidate(0, locale = $$props.locale);
		if ("temp" in $$props) $$invalidate(1, temp = $$props.temp);
		if ("windDirection" in $$props) $$invalidate(2, windDirection = $$props.windDirection);
		if ("windSpeed" in $$props) $$invalidate(3, windSpeed = $$props.windSpeed);
		if ("weatherSymbol" in $$props) $$invalidate(4, weatherSymbol = $$props.weatherSymbol);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	return [locale, temp, windDirection, windSpeed, weatherSymbol, lat, lon];
}

class YrWidget extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance$2, create_fragment$2, safe_not_equal, { lat: 5, lon: 6, locale: 0 });

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "YrWidget",
			options,
			id: create_fragment$2.name
		});

		const { ctx } = this.$$;
		const props = options.props || {};

		if (/*lat*/ ctx[5] === undefined && !("lat" in props)) {
			console.warn("<YrWidget> was created without expected prop 'lat'");
		}

		if (/*lon*/ ctx[6] === undefined && !("lon" in props)) {
			console.warn("<YrWidget> was created without expected prop 'lon'");
		}

		if (/*locale*/ ctx[0] === undefined && !("locale" in props)) {
			console.warn("<YrWidget> was created without expected prop 'locale'");
		}
	}

	get lat() {
		throw new Error("<YrWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set lat(value) {
		throw new Error("<YrWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get lon() {
		throw new Error("<YrWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set lon(value) {
		throw new Error("<YrWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get locale() {
		throw new Error("<YrWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set locale(value) {
		throw new Error("<YrWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}

const app = new YrWidget({
	target: document.body,
	props: {
		name: 'Voss',
		lat: '60.626714',
		lon: '6.3995496',
		locale: 'nn_NO',
	}
});

export default app;
