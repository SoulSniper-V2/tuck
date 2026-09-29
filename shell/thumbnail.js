// SPDX-License-Identifier: GPL-3.0-or-later
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {fitPreview} from '../model.js';
import {allocate, setAllocation} from './compat.js';
import {SignalGroup} from './signals.js';

export const Thumbnail = GObject.registerClass(
class Thumbnail extends St.Widget {
    _init(window, fallbackIcon) {
        super._init({style_class: 'tuck-thumbnail', clip_to_allocation: true});
        this._signals = new SignalGroup();
        this._source = window.get_compositor_private();
        this._fallback = fallbackIcon;
        this.add_child(this._fallback);
        this._clone = null;

        if (this._source) {
            this._clone = new Clutter.Clone({source: this._source, reactive: false});
            this.add_child(this._clone);
            this._signals.connect(this._source, 'notify::width', () => this.queue_relayout());
            this._signals.connect(this._source, 'notify::height', () => this.queue_relayout());
            this._signals.connect(this._source, 'destroy', () => {
                    this._clearSource();
                    this.queue_relayout();
            });
        }

        this.connect('destroy', () => this._clearSource());
    }

    _clearSource() {
        this._signals.clear();
        this._source = null;
        if (this._clone)
            this._clone.destroy();
        this._clone = null;
        this._fallback.show();
    }

    vfunc_allocate(box, flags) {
        setAllocation(this, box, flags);
        const width = box.get_width();
        const height = box.get_height();
        const fallbackBox = new Clutter.ActorBox({
            x1: (width - 32) / 2, y1: (height - 32) / 2,
            x2: (width + 32) / 2, y2: (height + 32) / 2,
        });
        allocate(this._fallback, fallbackBox, flags);

        if (!this._clone)
            return;

        const size = fitPreview(this._source.width, this._source.height, width, height);
        this._fallback.visible = size === null;
        if (!size) {
            this._clone.hide();
            return;
        }

        this._clone.show();
        allocate(this._clone, new Clutter.ActorBox({
            x1: (width - size.width) / 2, y1: (height - size.height) / 2,
            x2: (width + size.width) / 2, y2: (height + size.height) / 2,
        }), flags);
    }
});
