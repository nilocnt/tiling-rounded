import { Adw, Gdk, Gio, GLib, Gtk } from './src/dependencies/prefs/gi.js';
import { ExtensionPreferences } from './src/dependencies/prefs.js';

import LayoutPrefs from './src/prefs/layoutsPrefs.js';
import { Shortcuts } from './src/common.js';
import './src/prefs/shortcutListener.js';

export default class Prefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Load css file
        const provider = new Gtk.CssProvider();
        const path = GLib.build_filenamev([this.path, 'stylesheet.css']);
        provider.load_from_path(path);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );

        window.set_can_navigate_back(true);

        const settings = this.getSettings();
        const builder = new Gtk.Builder();
        builder.set_translation_domain(this.uuid);
        builder.add_from_file(`${this.path}/src/ui/prefs.ui`);

        // Add general preference page
        window.add(builder.get_object('general'));

        // Add keybindings preference page
        window.add(builder.get_object('keybindings'));

        this._addRoundedPreferencesPage(window);

        // Add layouts preference page on condition of advanced setting
        const layoutsPage = builder.get_object('layouts');
        settings.connect('changed::enable-advanced-experimental-features', () => {
            settings.get_boolean('enable-advanced-experimental-features')
                ? window.add(layoutsPage)
                : window.remove(layoutsPage);
        });

        if (settings.get_boolean('enable-advanced-experimental-features'))
            window.add(layoutsPage);

        // Bind settings to GUI
        this._bindSwitches(settings, builder);
        this._bindSpinbuttons(settings, builder);
        this._bindComboRows(settings, builder);
        this._bindRadioButtons(settings, builder);
        this._bindKeybindings(settings, builder);
        this._bindColorButtons(settings, builder);

        // LayoutPrefs manages everything related to layouts on the
        // prefs side (including the keyboard shortcuts)
        new LayoutPrefs(settings, builder, this.path);

        // Set visibility for deprecated settings
        this._setDeprecatedSettings(settings, builder);

        // Add a button into the headerbar with info
        this._addHeaderBarInfoButton(window, settings, builder);
    }

    _addRoundedPreferencesPage(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: 'Rounded Windows',
            icon_name: 'view-restore-symbolic',
        });
        const applicationsGroup = new Adw.PreferencesGroup({
            title: 'Applications',
            description: 'Some applications created with LibAdwaita or LibHandy already have rounded corners. You can enable those settings to avoid rounding their corners an extra time.',
        });
        const skipLibadwaitaRow = new Adw.SwitchRow({
            title: 'Skip LibAdwaita applications',
        });
        const skipLibhandyRow = new Adw.SwitchRow({
            title: 'Skip LibHandy applications',
        });
        settings.bind('skip-libadwaita-app', skipLibadwaitaRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        settings.bind('skip-libhandy-app', skipLibhandyRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        applicationsGroup.add(skipLibadwaitaRow);
        applicationsGroup.add(skipLibhandyRow);

        const globalSettingsGroup = new Adw.PreferencesGroup({
            title: 'Global settings',
            description: 'These settings will have an effect on all windows',
        });
        const addScaleRow = (title, adjustment, digits, mark) => {
            const row = new Adw.ActionRow({ title });
            const scale = new Gtk.Scale({
                adjustment,
                digits,
                draw_value: true,
                hexpand: true,
                round_digits: digits,
                value_pos: Gtk.PositionType.LEFT,
                valign: Gtk.Align.CENTER,
                width_request: 200,
            });
            scale.add_mark(mark, Gtk.PositionType.BOTTOM, String(mark));
            row.add_suffix(scale);
            globalSettingsGroup.add(row);
            return adjustment;
        };
        const borderWidth = addScaleRow('Border width', new Gtk.Adjustment({
            lower: -20,
            upper: 20,
            step_increment: 1,
            page_increment: 1,
        }), 0, 0);
        settings.bind('border-width', borderWidth, 'value',
            Gio.SettingsBindFlags.DEFAULT);

        const borderColorRow = new Adw.ActionRow({
            title: 'Border color',
            activatable: true,
        });
        const borderColor = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({ title: 'Border color' }),
            valign: Gtk.Align.CENTER,
        });
        borderColorRow.add_suffix(borderColor);
        borderColorRow.activatable_widget = borderColor;
        globalSettingsGroup.add(borderColorRow);

        const cornerRadius = addScaleRow('Corner radius', new Gtk.Adjustment({
            lower: 0,
            upper: 40,
            step_increment: 1,
            page_increment: 1,
        }), 0, 15);
        const cornerSmoothing = addScaleRow('Corner smoothing', new Gtk.Adjustment({
            lower: 0,
            upper: 1,
            step_increment: 0.1,
            page_increment: 0.1,
        }), 1, 0);
        const shadowRow = new Adw.ActionRow({
            title: 'Window shadow',
            subtitle: 'Customize the shadow of the rounded corner window',
            activatable: true,
        });
        shadowRow.add_suffix(new Gtk.Image({ icon_name: 'go-next-symbolic' }));
        shadowRow.connect('activated', () => {
            window.present_subpage(this._createShadowPreferencesPage(settings, window));
        });
        globalSettingsGroup.add(shadowRow);

        const keepShadowRow = new Adw.SwitchRow({
            title: 'Keep shadows for maximized and fullscreen windows',
        });
        const keepMaximizedRow = new Adw.SwitchRow({
            title: 'Keep rounded corners for maximized windows',
        });
        const keepFullscreenRow = new Adw.SwitchRow({
            title: 'Keep rounded corners for fullscreen windows',
        });
        settings.bind('keep-shadow-for-maximized-fullscreen', keepShadowRow, 'active',
            Gio.SettingsBindFlags.DEFAULT);
        globalSettingsGroup.add(keepShadowRow);
        globalSettingsGroup.add(keepMaximizedRow);
        globalSettingsGroup.add(keepFullscreenRow);

        const paddingsRow = this._createPaddingsRow();
        globalSettingsGroup.add(paddingsRow.row);

        let syncing = false;
        const sync = () => {
            const config = settings.get_value('global-rounded-corner-settings').recursiveUnpack();
            syncing = true;
            cornerRadius.value = config.borderRadius;
            cornerSmoothing.value = config.smoothing;
            keepMaximizedRow.active = config.keepRoundedCorners.maximized;
            keepFullscreenRow.active = config.keepRoundedCorners.fullscreen;
            paddingsRow.top.value = config.padding.top;
            paddingsRow.bottom.value = config.padding.bottom;
            paddingsRow.left.value = config.padding.left;
            paddingsRow.right.value = config.padding.right;
            const color = new Gdk.RGBA();
            [color.red, color.green, color.blue, color.alpha] = config.borderColor;
            borderColor.rgba = color;
            syncing = false;
        };
        const updateConfig = callback => {
            if (syncing) return;
            const config = settings.get_value('global-rounded-corner-settings').recursiveUnpack();
            callback(config);
            settings.set_value('global-rounded-corner-settings', new GLib.Variant('a{sv}', {
                padding: new GLib.Variant('a{su}', config.padding),
                keepRoundedCorners: new GLib.Variant('a{sb}', config.keepRoundedCorners),
                borderRadius: GLib.Variant.new_uint32(config.borderRadius),
                smoothing: GLib.Variant.new_double(config.smoothing),
                borderColor: new GLib.Variant('(dddd)', config.borderColor),
                enabled: GLib.Variant.new_boolean(config.enabled),
            }));
        };

        cornerRadius.connect('value-changed', () => updateConfig(config => {
            config.borderRadius = Math.round(cornerRadius.value);
        }));
        cornerSmoothing.connect('value-changed', () => updateConfig(config => {
            config.smoothing = cornerSmoothing.value;
        }));
        borderColor.connect('notify::rgba', () => updateConfig(config => {
            const color = borderColor.rgba;
            config.borderColor = [color.red, color.green, color.blue, color.alpha];
        }));
        keepMaximizedRow.connect('notify::active', () => updateConfig(config => {
            config.keepRoundedCorners.maximized = keepMaximizedRow.active;
        }));
        keepFullscreenRow.connect('notify::active', () => updateConfig(config => {
            config.keepRoundedCorners.fullscreen = keepFullscreenRow.active;
        }));
        for (const [side, adjustment] of Object.entries(paddingsRow)) {
            if (side === 'row') continue;
            adjustment.connect('value-changed', () => updateConfig(config => {
                config.padding[side] = Math.round(adjustment.value);
            }));
        }
        settings.connect('changed::global-rounded-corner-settings', sync);
        sync();

        page.add(applicationsGroup);
        page.add(globalSettingsGroup);
        window.add(page);
    }

    _createPaddingsRow() {
        const row = new Adw.PreferencesRow({ activatable: false });
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });
        box.append(new Gtk.Label({
            label: 'Paddings',
            xalign: 0.5,
            css_classes: ['title-4'],
        }));
        const flowBox = new Gtk.FlowBox({
            homogeneous: true,
            hexpand: true,
            max_children_per_line: 2,
            selection_mode: Gtk.SelectionMode.NONE,
        });
        const adjustments = {};
        for (const [side, title] of Object.entries({
            top: 'Top',
            bottom: 'Bottom',
            left: 'Left',
            right: 'Right',
        })) {
            const adjustment = new Gtk.Adjustment({
                lower: 0,
                upper: 100,
                step_increment: 1,
                page_increment: 10,
            });
            flowBox.append(new Adw.SpinRow({
                title,
                activatable: false,
                adjustment,
            }));
            adjustments[side] = adjustment;
        }
        box.append(flowBox);
        row.set_child(box);
        return { row, ...adjustments };
    }

    _createShadowPreferencesPage(settings, window) {
        const content = new Adw.PreferencesPage();
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar({
            title_widget: new Gtk.Label({
                label: 'Edit shadows',
                css_classes: ['heading'],
            }),
        });
        const backButton = new Gtk.Button({
            icon_name: 'go-previous-symbolic',
            tooltip_text: 'Back',
        });
        backButton.connect('clicked', () => window.close_subpage());
        header.pack_start(backButton);
        toolbar.add_top_bar(header);
        toolbar.set_content(content);

        const previewGroup = new Adw.PreferencesGroup();
        const previewRow = new Adw.PreferencesRow({ activatable: false });
        const preview = new Gtk.Box({
            halign: Gtk.Align.CENTER,
            spacing: 48,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
            css_classes: ['rounded-shadow-preview'],
        });
        const focusedPreview = new Gtk.Label({
            label: 'Focused window',
            width_request: 192,
            height_request: 192,
            css_classes: ['rounded-shadow-preview-window'],
        });
        const unfocusedPreview = new Gtk.Label({
            label: 'Unfocused window',
            width_request: 192,
            height_request: 192,
            css_classes: ['rounded-shadow-preview-window'],
        });
        preview.append(focusedPreview);
        preview.append(unfocusedPreview);
        previewRow.set_child(preview);
        previewGroup.add(previewRow);
        content.add(previewGroup);

        const focusedPreviewProvider = new Gtk.CssProvider();
        const unfocusedPreviewProvider = new Gtk.CssProvider();
        const backgroundProvider = new Gtk.CssProvider();
        for (const [widget, provider] of [
            [focusedPreview, focusedPreviewProvider],
            [unfocusedPreview, unfocusedPreviewProvider],
            [preview, backgroundProvider],
        ]) {
            widget.get_style_context().add_provider(
                provider,
                Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION,
            );
        }

        const shadowCss = shadow => {
            const opacity = Math.max(0, Math.min(100, shadow.opacity)) / 100;
            return `${shadow.horizontalOffset}px ${shadow.verticalOffset}px ` +
                `${shadow.blurOffset}px ${shadow.spreadRadius}px ` +
                `rgba(0, 0, 0, ${opacity})`;
        };
        const updatePreview = () => {
            const focused = settings.get_value('focused-shadow').recursiveUnpack();
            const unfocused = settings.get_value('unfocused-shadow').recursiveUnpack();
            focusedPreviewProvider.load_from_string(`
                .rounded-shadow-preview-window {
                    transition: box-shadow 200ms;
                    box-shadow: ${shadowCss(focused)};
                    border-radius: 15px;
                    background: #25252a;
                    color: #ffffff;
                }
                .rounded-shadow-preview-window:hover {
                    box-shadow: ${shadowCss(unfocused)};
                }
            `);
            unfocusedPreviewProvider.load_from_string(`
                .rounded-shadow-preview-window {
                    transition: box-shadow 200ms;
                    box-shadow: ${shadowCss(unfocused)};
                    border-radius: 15px;
                    background: #25252a;
                    color: #ffffff;
                }
                .rounded-shadow-preview-window:hover {
                    box-shadow: ${shadowCss(focused)};
                }
            `);
        };
        const updatePreviewBackground = () => {
            const backgrounds = new Gio.Settings({
                schema_id: 'org.gnome.desktop.background',
            });
            const styleManager = new Adw.StyleManager();
            const pictureUri = styleManager.get_dark()
                ? backgrounds.get_string('picture-uri-dark')
                : backgrounds.get_string('picture-uri');
            backgroundProvider.load_from_string(`
                .rounded-shadow-preview {
                    background: url("${pictureUri}");
                    background-size: cover;
                    border-radius: 12px;
                }
            `);
        };

        const shadows = [
            ['Focused shadow preferences', 'focused-shadow'],
            ['Unfocused shadow preferences', 'unfocused-shadow'],
        ];
        for (const [title, key] of shadows) {
            const group = new Adw.PreferencesGroup();
            const expander = new Adw.ExpanderRow({
                title,
                expanded: true,
                enable_expansion: true,
            });
            const shadow = settings.get_value(key).recursiveUnpack();
            for (const [property, label, lower, upper] of [
                ['horizontalOffset', 'Horizontal offset', -60, 60],
                ['verticalOffset', 'Vertical offset', -60, 60],
                ['blurOffset', 'Blur radius', 0, 60],
                ['spreadRadius', 'Spread radius', -60, 60],
                ['opacity', 'Opacity', 0, 100],
            ]) {
                const adjustment = new Gtk.Adjustment({
                    lower,
                    upper,
                    step_increment: 1,
                    page_increment: 1,
                    value: shadow[property],
                });
                const row = new Adw.ActionRow({
                    title: label,
                });
                const scale = new Gtk.Scale({
                    adjustment,
                    digits: 0,
                    draw_value: true,
                    hexpand: true,
                    round_digits: 0,
                    value_pos: Gtk.PositionType.LEFT,
                    valign: Gtk.Align.CENTER,
                    width_request: 200,
                });
                scale.add_mark(shadow[property], Gtk.PositionType.BOTTOM,
                    String(shadow[property]));
                row.add_suffix(scale);
                adjustment.connect('value-changed', () => {
                    shadow[property] = Math.round(adjustment.value);
                    settings.set_value(key, new GLib.Variant('a{si}', shadow));
                    updatePreview();
                });
                expander.add_row(row);
            }
            group.add(expander);
            content.add(group);
        }
        updatePreview();
        updatePreviewBackground();

        return new Adw.NavigationPage({
            title: 'Edit shadows',
            child: toolbar,
        });
    }

    /*
    * Bind GUI switches to settings.
    */
    _bindSwitches(settings, builder) {
        const switches = [
            'enable-tiling-popup',
            'tiling-popup-all-workspace',
            'enable-raise-tile-group',
            'tilegroups-in-app-switcher',
            'maximize-with-gap',
            'show-layout-panel-indicator',
            'enable-advanced-experimental-features',
            'disable-tile-groups',
            'low-performance-move-mode',
            'enable-layout-picker',
            'monitor-switch-grace-period',
            'adapt-edge-tiling-to-favorite-layout',
            'enable-tile-animations',
            'enable-untile-animations',
            'enable-hold-maximize-inverse-landscape',
            'enable-hold-maximize-inverse-portrait'
        ];

        switches.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    /*
    * Bind GUI spinbuttons to settings.
    */
    _bindSpinbuttons(settings, builder) {
        const spinButtons = [
            'window-gap',
            'single-screen-gap',
            'screen-top-gap',
            'screen-left-gap',
            'screen-right-gap',
            'screen-bottom-gap',
            'focus-hint-outline-size',
            'focus-hint-outline-border-radius',
            'toggle-maximize-tophalf-timer',
            'vertical-preview-area',
            'horizontal-preview-area'
        ];

        spinButtons.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'value', Gio.SettingsBindFlags.DEFAULT);
        });
    }

    /*
    * Bind GUI AdwComboRows to settings.
    */
    _bindComboRows(settings, builder) {
        const comboRows = [
            'focus-hint-outline-style',
            'move-adaptive-tiling-mod',
            'move-favorite-layout-mod',
            'ignore-ta-mod'
        ];

        comboRows.forEach(key => {
            const widget = builder.get_object(key.replaceAll('-', '_'));
            settings.bind(key, widget, 'selected', Gio.SettingsBindFlags.DEFAULT);
            widget.set_selected(settings.get_int(key));
        });
    }

    /*
    * Bind GUI color buttons to settings.
    */
    _bindColorButtons(settings, builder) {
        const switches = [
            'focus-hint-color'
        ];

        switches.forEach(key => {
            const widget = builder.get_object(`${key.replaceAll('-', '_')}_button`);
            widget.connect('color-set', () => {
                settings.set_string(key, widget.get_rgba().to_string());
            });

            // initialize color
            const rgba = new Gdk.RGBA();
            rgba.parse(settings.get_string(key));
            widget.set_rgba(rgba);
        });
    }

    /*
    * Bind radioButtons to settings.
    */
    _bindRadioButtons(settings, builder) {
        // These 'radioButtons' are basically just used as a 'fake ComboBox' with
        // explanations for the different options. So there is just *one* gsetting
        // (an int) which saves the current 'selection'.
        const radioButtons = [
            {
                key: 'dynamic-keybinding-behavior',
                rowNames: [
                    'dynamic_keybinding_disabled_row',
                    'dynamic_keybinding_window_focus_row',
                    'dynamic_keybinding_tiling_state_row',
                    'dynamic_keybinding_tiling_state_windows_row',
                    'dynamic_keybinding_favorite_layout_row'
                ]
            },
            {
                key: 'focus-hint',
                rowNames: [
                    'disabled_focus_hint_row',
                    'animated_outline_focus_hint_row',
                    'animated_upscale_focus_hint_row',
                    'static_outline_focus_hint_row'
                ]
            },
            {
                key: 'default-move-mode',
                rowNames: [
                    'edge_tiling_row',
                    'adaptive_tiling_row',
                    'favorite_layout_row',
                    'ignore_ta_row'
                ]
            }
        ];

        radioButtons.forEach(({ key, rowNames }) => {
            const currActive = settings.get_int(key);

            rowNames.forEach((name, idx) => {
                const row = builder.get_object(name.replaceAll('-', '_'));
                const checkButton = row.activatable_widget;
                checkButton.connect('toggled', () => settings.set_int(key, idx));

                // Set initial state
                if (idx === currActive)
                    checkButton.activate();
            });
        });
    }

    /*
    * Bind keybinding widgets to settings.
    */
    _bindKeybindings(settings, builder) {
        const shortcuts = Shortcuts.getAllKeys();
        shortcuts.forEach(key => {
            const shortcut = builder.get_object(key.replaceAll('-', '_'));
            shortcut.initialize(key, settings);
        });
    }

    /**
     * Sets the visibility of deprecated settings. Those setting aren't visible
     * in the GUI unless they have a user set value. That means they aren't
     * discoverable through the GUI and need to first be set with the gsetting.
     * The normal rows should have the id of: GSETTING_WITH_UNDERSCORES_row.
     * ShortcutListeners have the format of GSETTING_WITH_UNDERSCORES.
     */
    _setDeprecatedSettings(settings, builder) {
        // Keybindings
        ['toggle-tiling-popup', 'auto-tile'].forEach(s => {
            const isNonDefault = settings.get_strv(s)[0] !== settings.get_default_value(s).get_strv()[0];
            builder.get_object(s.replaceAll('-', '_')).set_visible(isNonDefault);
        });

        // Switches
        ['tilegroups-in-app-switcher'].forEach(s => {
            const isNonDefault = settings.get_boolean(s) !== settings.get_default_value(s).get_boolean();
            builder.get_object(s.replaceAll('-', '_')).set_visible(isNonDefault);
        });
    }

    _addHeaderBarInfoButton(window, settings, builder) {
        // Add headerBar button for menu
        // TODO: is this a 'reliable' method to access the headerbar?
        const page = builder.get_object('general');
        const gtkStack = page
            .get_parent()
            .get_parent()
            .get_parent();
        const adwHeaderBar = gtkStack
            .get_next_sibling()
            .get_first_child()
            .get_first_child()
            .get_first_child();

        adwHeaderBar.pack_start(builder.get_object('info_menu'));

        // Setup menu actions
        const actionGroup = new Gio.SimpleActionGroup();
        window.insert_action_group('prefs', actionGroup);

        const bugReportAction = new Gio.SimpleAction({ name: 'open-bug-report' });
        bugReportAction.connect('activate', this._openBugReport.bind(this, window));
        actionGroup.add_action(bugReportAction);

        const userGuideAction = new Gio.SimpleAction({ name: 'open-user-guide' });
        userGuideAction.connect('activate', this._openUserGuide.bind(this, window));
        actionGroup.add_action(userGuideAction);

        const changelogAction = new Gio.SimpleAction({ name: 'open-changelog' });
        changelogAction.connect('activate', this._openChangelog.bind(this, window));
        actionGroup.add_action(changelogAction);

        const licenseAction = new Gio.SimpleAction({ name: 'open-license' });
        licenseAction.connect('activate', this._openLicense.bind(this, window));
        actionGroup.add_action(licenseAction);

        const hiddenSettingsAction = new Gio.SimpleAction({ name: 'open-hidden-settings' });
        hiddenSettingsAction.connect('activate', this._openHiddenSettings.bind(this, window, builder));
        actionGroup.add_action(hiddenSettingsAction);

        // Button to return to main settings page
        const returnButton = builder.get_object('hidden_settings_return_button');
        returnButton.connect('clicked', () => window.close_subpage());
    }

    _openBugReport(window) {
        Gtk.show_uri(window, 'https://github.com/nilocnt/tiling-rounded/issues', Gdk.CURRENT_TIME);
    }

    _openUserGuide(window) {
        Gtk.show_uri(window, 'https://github.com/nilocnt/tiling-rounded/wiki', Gdk.CURRENT_TIME);
    }

    _openChangelog(window) {
        Gtk.show_uri(window, 'https://github.com/nilocnt/tiling-rounded/blob/main/README.md', Gdk.CURRENT_TIME);
    }

    _openLicense(window) {
        Gtk.show_uri(window, 'https://github.com/nilocnt/tiling-rounded/blob/main/LICENSE', Gdk.CURRENT_TIME);
    }

    _openHiddenSettings(window, builder) {
        const hiddenSettingsPage = builder.get_object('hidden_settings');
        window.present_subpage(hiddenSettingsPage);
    }
}
