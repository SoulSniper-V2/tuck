"""Real GTK windows for long-content, scrolling, search, and closure checks."""
import gi

gi.require_version('Adw', '1')
gi.require_version('Gtk', '4.0')
from gi.repository import Adw, Gtk

app = Adw.Application(application_id='org.example.TuckWindowTest')


def activate(application):
    titles = [
        'Research notes',
        'Release checklist',
        'Café résumé — a deliberately long window title to check ellipsizing and keyboard accessibility',
    ] + [f'Reference document {number}' for number in range(4, 10)]
    for index, title in enumerate(titles):
        window = Adw.ApplicationWindow(application=application, title=title,
                                      default_width=620 + index * 10, default_height=450)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        header = Adw.HeaderBar()
        header.set_title_widget(Adw.WindowTitle(title=title, subtitle='Tuck runtime fixture'))
        box.append(header)
        text = Gtk.TextView(editable=False, cursor_visible=False, monospace=True,
                            wrap_mode=Gtk.WrapMode.WORD_CHAR, vexpand=True,
                            left_margin=28, right_margin=28, top_margin=26, bottom_margin=26)
        text.get_buffer().set_text(
            f'{title}\n\nThis is a real GTK window used to exercise Tuck.\n\n'
            '• Recognizable previews\n• Search by title\n• Retrieve on the existing workspace\n'
            '• Bring here when switching tasks\n\nNo product usage or customer claim is implied.')
        box.append(text)
        window.set_content(box)
        window.present()


app.connect('activate', activate)
app.run([])
