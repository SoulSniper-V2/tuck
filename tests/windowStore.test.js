import assert from 'node:assert/strict';
import {test} from 'node:test';
import {WindowStore} from '../windowStore.js';

class Window {
    constructor() {
        this.minimized = false;
        this.skip_taskbar = false;
        this.workspace = {name: 'Original'};
        this.signals = new Map();
        this.nextId = 1;
        this.type = 0;
        this.transient = null;
        this.minimizable = true;
        this.sticky = false;
    }

    get_window_type() { return this.type; }
    get_transient_for() { return this.transient; }
    can_minimize() { return this.minimizable; }
    is_on_all_workspaces() { return this.sticky; }
    connect(name, callback) {
        const id = this.nextId++;
        this.signals.set(id, {name, callback});
        return id;
    }

    disconnect(id) { this.signals.delete(id); }
    emit(name) {
        for (const signal of [...this.signals.values()]) {
            if (signal.name === name)
                signal.callback();
        }
    }

    minimize() { this.minimized = true; this.emit('notify::minimized'); }
    unminimize() { this.minimized = false; this.emit('notify::minimized'); }
    change_workspace(workspace) { this.workspace = workspace; this.emit('workspace-changed'); }
}

function setup() {
    const active = {name: 'Here'};
    const activated = [];
    let changes = 0;
    const store = new WindowStore({
        normalType: 0,
        activate: window => activated.push(window),
        currentWorkspace: () => active,
        changed: () => changes++,
    });
    return {store, active, activated, changes: () => changes};
}

test('parking is explicit, idempotent, and rejects non-user windows', () => {
    const {store} = setup();
    assert.equal(store.park(null), false);
    for (const options of [{type: 1}, {skip_taskbar: true}, {transient: {}}, {minimizable: false}, {minimized: true}]) {
        const window = Object.assign(new Window(), options);
        assert.equal(store.park(window), false);
        assert.equal(window.signals.size, 0);
    }
    const window = new Window();
    assert.equal(store.park(window), true);
    assert.equal(store.park(window), false);
    assert.equal(window.minimized, true);
    assert.deepEqual(store.windows, [window]);
    store.destroy();
});

test('external restore or closure releases ownership and every signal', () => {
    const {store, changes} = setup();
    const window = new Window();
    store.park(window);
    window.emit('notify::title');
    assert.equal(changes(), 2);
    window.unminimize();
    assert.deepEqual(store.windows, []);
    assert.equal(window.signals.size, 0);
    store.park(window);
    window.emit('unmanaged');
    assert.deepEqual(store.windows, []);
    assert.equal(window.signals.size, 0);
});

test('restore respects the original workspace; Bring here is explicit', () => {
    const {store, active, activated} = setup();
    const window = new Window();
    const original = window.workspace;
    store.park(window);
    assert.equal(store.restore(window), true);
    assert.equal(window.workspace, original);
    assert.deepEqual(activated, [window]);
    assert.equal(store.restore(window), false);
    store.park(window);
    assert.equal(store.restore(window, true), true);
    assert.equal(window.workspace, active);
    assert.equal(window.minimized, false);
    assert.equal(window.signals.size, 0);
});

test('sticky windows retain their all-workspaces state when brought here', () => {
    const {store} = setup();
    const window = new Window();
    window.sticky = true;
    const original = window.workspace;
    store.park(window);
    store.restore(window, true);
    assert.equal(window.workspace, original);
    assert.equal(window.sticky, true);
});

test('failed minimize rolls back ownership; failed move leaves a recovery path', () => {
    const {store} = setup();
    const window = new Window();
    window.minimize = () => { throw new Error('minimize failed'); };
    assert.throws(() => store.park(window), /minimize failed/);
    assert.equal(window.signals.size, 0);
    assert.deepEqual(store.windows, []);
    window.minimize = () => {};
    assert.equal(store.park(window), false);
    assert.equal(window.signals.size, 0);
    window.minimize = Window.prototype.minimize;
    store.park(window);
    window.change_workspace = () => { throw new Error('move failed'); };
    assert.throws(() => store.restore(window, true), /move failed/);
    assert.deepEqual(store.windows, [window]);
    store.destroy();
    assert.equal(window.minimized, false);
});

test('disable reveals only still-owned windows without moving or activating them', () => {
    const {store, activated} = setup();
    const parked = new Window();
    const ordinary = new Window();
    const original = parked.workspace;
    ordinary.minimize();
    store.park(parked);
    store.destroy();
    assert.equal(parked.minimized, false);
    assert.equal(parked.workspace, original);
    assert.equal(parked.signals.size, 0);
    assert.equal(ordinary.minimized, true);
    assert.deepEqual(activated, []);
    assert.deepEqual(store.windows, []);
});

test('failed restore stays recoverable and cleanup continues past a failing window', () => {
    const {store} = setup();
    const broken = new Window();
    const healthy = new Window();
    store.park(broken);
    store.park(healthy);
    broken.unminimize = () => { throw new Error('restore failed'); };
    assert.throws(() => store.restore(broken), /restore failed/);
    assert.deepEqual(store.windows, [broken, healthy]);
    assert.throws(() => store.destroy(), /restore failed/);
    assert.equal(healthy.minimized, false);
    assert.equal(broken.signals.size, 0);
    assert.equal(healthy.signals.size, 0);
    assert.deepEqual(store.windows, []);
});
