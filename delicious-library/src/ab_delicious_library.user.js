// ==UserScript==
// @name        AB Delicious Userscript Library
// @namespace   TheFallingMan
// @version     0.0.1
// @description Provides useful functions for AnimeBytes userscripts.
// @author      TheFallingMan
// @icon        https://animebytes.tv/favicon.ico
// @include     https://animebytes.tv/*
// @license     GPL-3.0
// @grant       GM_getValue
// @grant       GM_setValue
// ==/UserScript==

/* global GM_setValue:false, GM_getValue:false */

/* eslint-disable-next-line no-unused-vars */
var delicious = (function ABDeliciousLibrary(){
    "use strict";

    function newElement(tagName, properties, children) {
        var elem = document.createElement(tagName);
        if (properties) {
            for (var key in properties) {
                if (properties.hasOwnProperty(key)) {
                    elem[key] = properties[key];
                }
            }
        }
        if (children) {
            for (var i = 0; i < children.length; i++) {
                if (typeof children[i] === 'string') {
                    elem.appendChild(document.createTextNode(children[i]));
                } else {
                    elem.appendChild(children[i]);
                }
            }
        }
        return elem;
    }


    function log(message) {
        console.debug(
            typeof message === 'string' ? ('[Delicious] '+message) : message
        );
    }

    var utilities = {
        toggleSubnav: function(ev) {
            var subnav = ev.currentTarget.parentNode.children[1];
            var willShow = (subnav.style.display==='none');
            subnav.style.display = willShow?'block':'none';
            if (willShow)
                subnav.parentNode.classList.add('selected');
            else
                subnav.parentNode.classList.remove('selected');
            ev.stopPropagation();
            ev.preventDefault();
            return false;
        },

        applyDefaults: function(options, defaults) {
            if (!options)
                return defaults;
            var newObject = {};
            for (var key in defaults) {
                if (defaults.hasOwnProperty(key)) {
                    if (options.hasOwnProperty(key))
                        newObject[key] = options[key];
                    else
                        newObject[key] = defaults[key];
                }
            }
            return newObject;
        },

        htmlEscape: function(text) {
            return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        },

        _bytes_units: ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'],
        _bytes_base: 1024,
        nbsp: '\xa0',

        parseBytes: function(bytesString) {
            var split = bytesString.split(/\s+/);
            var significand = parseFloat(split[0]);
            var magnitude = this._bytes_units.indexOf(split[1]);
            if (magnitude === -1)
                throw 'Bytes unit not recognised. Make sure you are using KiB, MiB, or similar.';
            return significand * Math.pow(this._bytes_base, magnitude);
        },

        // Adapted from https://stackoverflow.com/a/18650828
        formatBytes: function(numBytes, decimals) {
            if (numBytes === 0) return '0 ' + this._bytes_units[0];
            var magnitude = Math.floor(Math.log(numBytes) / Math.log(this._bytes_base));
            // Extra parseFloat is so trailing 0's are removed.
            return parseFloat(
                (numBytes / Math.pow(this._bytes_base, magnitude)).toFixed(decimals)
            ) + ' ' + this._bytes_units[magnitude];
        }
    };


    var _isSettingsPage = window.location.href.indexOf('/user.php?action=edit') !== -1;

    var settings = {
        isSettingsPage: _isSettingsPage,

        _createDeliciousPage: function() {
            log('Creating settings page...');
            var settingsDiv = document.createElement('div');
            settingsDiv.id = 'delicious_settings';

            var header = document.createElement('div');
            header.className = 'head colhead_dark strong';
            header.textContent = 'Userscript Settings';
            settingsDiv.appendChild(header);

            var settingsList = document.createElement('ul');
            settingsList.className = 'nobullet ue_list';

            var simpleSection = document.createElement('div');
            simpleSection.id = 'delicious_basic_settings';
            settingsList.appendChild(simpleSection);

            settingsDiv.appendChild(settingsList);

            return settingsDiv;
        },

        /**
         *
         * @param {MouseEvent} ev
         */
        _tabLinkClick: function(ev) {
            log('Clicked tab link: ' + ev.target.textContent);
            var clickedId = ev.target.getAttribute('href').replace(/^#/, '');
            document.querySelector('.ue_tabs .selected').classList.remove('selected');
            var tabs = document.querySelectorAll('#tabs > div');
            for (var i = 0; i < tabs.length; i++) {
                tabs[i].style.display = (tabs[i].id === clickedId)?'block':'none';
            }

            ev.target.classList.add('selected');
            ev.stopPropagation();
            ev.preventDefault();
            return false;
        },

        _relinkClickHandlers: function() {
            log('Rebinding tab click handlers...');
            var tabLinks = document.querySelectorAll('.ue_tabs a');
            for (var i = 0; i < tabLinks.length; i++) {
                tabLinks[i].addEventListener('click', this._tabLinkClick);
            }
        },

        insertSettingsPage: function(label, settingsPage) {
            log('Inserting a settings page...');
            var linkItem = document.createElement('li');
            linkItem.appendChild(document.createTextNode('•'));

            var link = document.createElement('a');
            link.href = '#' + settingsPage.id;
            link.textContent = label;
            linkItem.appendChild(link);

            document.querySelector('.ue_tabs').appendChild(linkItem);
            this._relinkClickHandlers();

            settingsPage.style.display = 'none';
            var tabs = document.querySelector('#tabs');
            tabs.insertBefore(settingsPage, tabs.lastElementChild);
        },

        _insertDeliciousSettings: function() {
            this.insertSettingsPage('Userscript Settings',
                this._createDeliciousPage());

            var userform = document.querySelector('form#userform');
            userform.addEventListener('submit', this._deliciousSaveAndSubmit);

            if (userform.hasAttribute('onsubmit')) {
                userform.dataset['onsubmit'] = userform.getAttribute('onsubmit');
                userform.removeAttribute('onsubmit');
                log('Previous onsubmit: ' + userform.dataset['onsubmit']);
            }
        },

        _settingsInserted: !!document.getElementById('delicious_settings'),

        ensureSettingsInserted: function() {
            if (!this.isSettingsPage) {
                if (!this.rootSettingsList) {
                    this._basicSection = newElement('div',
                        {id: 'delicious_basic_settings',
                            className: 'dummy'});
                    this.rootSettingsList = newElement('ul',
                        {className: 'dummy nobullet ue_list'},
                        [this._basicSection]);
                }
                return false;
            } else {
                if (!this._settingsInserted) {
                    log('Settings not yet inserted; inserting...');
                    this._settingsInserted = true;

                    this._insertDeliciousSettings();
                }
                if (!this.rootSettingsList) {
                    this.rootSettingsList = document.querySelector('#delicious_settings .ue_list');
                    this._basicSection = this.rootSettingsList.querySelector('#delicious_basic_settings');
                }
                return true;
            }
        },

        _deliciousSaveAndSubmit: function(ev) {
            if (settings.saveAllSettings(ev)) {
                ev.target.removeEventListener('submit', settings._deliciousSaveAndSubmit);
                ev.target.setAttribute('onsubmit', ev.target.dataset['onsubmit']);
                ev.target.submit();
            } else {
                var errorBox = document.querySelector('.error_message');
                if (errorBox)
                    errorBox.scrollIntoView();
            }
        },

        saveAllSettings: function(ev) {
            log('Saving all settings...');
            var cancelled = false;
            var settingsItems = ev.target.querySelectorAll('[data-settings-key]');
            for (var i = 0; i < settingsItems.length; i++) {
                log('Sending save event for setting key: ' + settingsItems[i].dataset['settingsKey']);
                var saveEvent = new Event('deliciousSave', {cancelable: true});
                if (!settingsItems[i].dispatchEvent(saveEvent)) {
                    cancelled = true;
                }
            }
            log('Form submit cancelled: ' + cancelled);
            if (cancelled) {
                ev.preventDefault();
                ev.stopPropagation();
                return false;
            }
        },

        saveOneElement: function(element, property) {
            if (element.dataset['settingsKey'])
                this.set(element.dataset['settingsKey'], element[property]);
            else
                log('Skipping blank: ' + element.outerHTML);
        },

        init: function(key, defaultValue) {
            if (GM_getValue(key, undefined) === undefined) {
                this.set(defaultValue);
            }
        },

        set: function(key, value) {
            GM_setValue(key, JSON.stringify(value));
        },

        get: function(key, defaultValue) {
            var value = GM_getValue(key, undefined);
            if (value !== undefined) {
                return JSON.parse(value);
            } else {
                return defaultValue;
            }
        },

        _insertSorted: function(newText, newElement, rootElement, skipFirst) {
            var current = rootElement.firstElementChild;
            if (skipFirst)
                current = current.nextElementSibling;
            while (current && (current.firstElementChild.textContent < newText)) {
                current = current.nextElementSibling;
            }
            if (current) {
                rootElement.insertBefore(newElement, current);
            } else {
                rootElement.appendChild(newElement);
            }
        },

        addScriptCheckbox: function(key, label, description, options) {
            var checkboxLI = this.createCheckbox(
                key, label, description, options);
            //this._basicSection.appendChild(checkboxLI);
            this.addBasicSetting(checkboxLI);
            return checkboxLI;
        },

        addBasicSetting: function(setting) {
            this._insertSorted(setting.textContent,
                setting, this._basicSection);
        },

        addScriptSection: function(key, title, description, options) {
            var section = this.createSection(title);

            var enableBox = this.createCheckbox(key, 'Enable/Disable', description, options);
            enableBox.style.marginTop = '10px';
            section.appendChild(enableBox);

            this._insertSorted(title.textContent || title, section, this.rootSettingsList, true);
            return section;
        },

        _createSettingLI: function(label, rightElements) {
            return newElement('li', {}, [
                newElement('span', {className: 'ue_left strong'}, [label]),
                newElement('span', {className: 'ue_right'}, rightElements),
            ]);
        },

        createCheckbox: function(key, label, description, options) {
            options = utilities.applyDefaults(options, {
                default: true,
                onSave: function(ev) {
                    settings.saveOneElement(ev.target, 'checked');
                }
            });

            var checkbox = newElement('input', {type: 'checkbox'});
            checkbox.dataset['settingsKey'] = key;

            var currentValue = options['default'];
            if (this.get(key, currentValue))
                checkbox.setAttribute('checked', 'checked');

            if (options['onSave'] !== null) {
                checkbox.addEventListener('deliciousSave', options['onSave']);
            }

            var li = this._createSettingLI(label, [
                checkbox,
                ' ',
                newElement('label', {}, [description]),
            ]);

            return li;
        },

        createSection: function(title) {
            var heading = newElement('h3', {}, [title]);
            var section = newElement('div', {className: 'delicious_settings_section'}, [
                newElement('li', {}, [heading])
            ]);
            section.style.marginTop = '25px';
            return section;
        },

        createTextField: function(key, label, description, options) {
            options = utilities.applyDefaults(options, {
                width: 50,
                lineBreak: false,
                default: '',
                onSave: function(ev) {
                    settings.saveOneElement(ev.target, 'value');
                }
            });

            var inputElem = newElement('input', {
                type: 'text',
                size: options['width']
            });
            inputElem.value = this.get(key, options['default']);
            inputElem.dataset['settingsKey'] = key;

            var li = this._createSettingLI(label, [
                inputElem,
                (options['lineBreak'] && description) ? newElement('br') : ' ',
                description
            ]);

            if (options['onSave'] !== null) {
                inputElem.addEventListener('deliciousSave', options['onSave']);
            }

            return li;
        },

        createDropDown: function(key, label, description, valuesArray, options) {
            options = utilities.applyDefaults(options, {
                lineBreak: false,
                default: null,
                onSave: function(ev) {
                    settings.saveOneElement(ev.target, 'value');
                }
            });

            var select = newElement('select');
            select.dataset['settingsKey'] = key;

            var currentValue = null;
            if (options['default'] !== null)
                currentValue = this.get(key, options['default']);

            for (var i = 0; i < valuesArray .length; i++) {
                var newOption = newElement('option', {
                    value: valuesArray[i][1],
                    textContent: valuesArray[i][0]
                });
                if (valuesArray[i][1] === currentValue)
                    newOption.setAttribute('selected', 'selected');
                select.appendChild(newOption);
            }

            var li = this._createSettingLI(label, [
                select,
                (options['lineBreak'] && description) ? newElement('br') : ' ',
                description
            ]);

            if (options['onSave'] !== null) {
                select.addEventListener('deliciousSave', options['onSave']);
            }

            return li;
        },

        createNumberInput: function(key, label, description, options) {
            options = utilities.applyDefaults(options, {
                lineBreak: false,
                default: '',
                onSave: function(ev) {
                    settings.set(key, parseFloat(ev.target.value));
                }
            });

            var input = newElement('input');
            input.dataset['settingsKey'] = key;
            input.type = 'number';
            input.value = this.get(key, options['default']);

            var li = this._createSettingLI(label, [
                input,
                (options['lineBreak'] && description) ? newElement('br') : ' ',
                description
            ]);

            if (options['onSave'] !== null) {
                input.addEventListener('deliciousSave', options['onSave']);
            }

            return li;
        },

        createFieldSetSetting: function(key, label, fields, description, options) {
            options = utilities.applyDefaults(options, {
                default: [fields[0][1]],
                onSave: function(ev) {
                    var obj = {};
                    var checkboxes = ev.target.querySelectorAll('[data-settings-subkey]');
                    for (var i = 0; i < checkboxes.length; i++) {
                        obj[checkboxes[i].dataset['settingsSubkey']] = checkboxes[i].checked;
                    }
                    settings.set(ev.target.dataset['settingsKey'], obj);
                }
            });

            var fieldset = newElement('span');
            fieldset.dataset['settingsKey'] = key;

            var currentSettings = this.get(key, {});

            for (var i = 0; i < fields.length; i++) {
                var checkbox = newElement('input');
                checkbox.type = 'checkbox';
                checkbox.dataset['settingsSubkey'] = fields[i][1];

                var current = currentSettings[fields[i][1]];
                if (current === undefined)
                    current = options['default'].indexOf(fields[i][1]) !== -1;

                if (current)
                    checkbox.checked = true;

                var newLabel = newElement('label', {}, [
                    checkbox, ' ', fields[i][0]
                ]);
                newLabel.style.marginRight = '15px';

                fieldset.appendChild(newLabel);
            }

            if (options['onSave'] !== null) {
                fieldset.addEventListener('deliciousSave', options['onSave']);
            }

            var li = this._createSettingLI(label, [
                fieldset, newElement('br'),
                description
            ]);

            return li;
        },

        _moveRowUp: function(ev) {
            var thisRow = ev.target.parentNode;
            if (thisRow.previousElementSibling) {
                thisRow.parentNode.insertBefore(
                    thisRow,
                    thisRow.previousElementSibling
                );
            }
            if (ev.preventDefault) {
                ev.preventDefault();
                ev.stopPropagation();
            }
        },

        _moveRowDown: function(ev) {
            var thisRow = ev.target.parentNode;
            if (thisRow.nextElementSibling) {
                settings._moveRowUp({target: thisRow.nextElementSibling.firstElementChild});
            }
            ev.preventDefault();
            ev.stopPropagation();
        },

        _deleteRow: function(ev) {
            var row = ev.target.parentNode;
            row.parentNode.removeChild(row);
            ev.preventDefault();
            ev.stopPropagation();
        },

        _createRow: function(values, columns, allowSort, allowDelete) {
            var row = newElement('div', {className: 'setting_row'});
            row.style.marginBottom = '2px';

            if (allowSort === undefined || allowSort) {
                var upButton = newElement('button', {textContent: '▲',
                    title: 'Move up'});
                upButton.addEventListener('click', this._moveRowUp);
                row.appendChild(upButton);
                row.appendChild(document.createTextNode(' '));

                var downButton = newElement('button', {textContent: '▼',
                    title: 'Move down'});
                downButton.addEventListener('click', this._moveRowDown);
                row.appendChild(downButton);
                row.appendChild(document.createTextNode(' '));
            }

            for (var i = 0; i < columns.length; i++) {
                var cell = newElement('input', {type: columns[i][2]});
                var subkey = columns[i][1];
                cell.dataset['settingsSubkey'] = subkey;
                cell.placeholder = columns[i][0];
                if (values[subkey] !== undefined) {
                    cell.value = values[subkey];
                }
                row.appendChild(cell);
                row.appendChild(document.createTextNode(' '));
            }

            if (allowDelete === undefined || allowDelete) {
                var delButton = newElement('button', {textContent: '✖',
                    title: 'Delete'});
                delButton.addEventListener('click', this._deleteRow);
                row.appendChild(delButton);
            }

            return row;
        },

        createRowSetting: function(key, label, columns, description, options) {
            options = utilities.applyDefaults(options, {
                default: [],
                newButtonText: '+',
                allowSort: true,
                allowDelete: true,
                allowNew: true,
                onSave: function(ev) {
                    var list = [];
                    var rows = ev.target.querySelectorAll('.setting_row');
                    for (var i = 0; i < rows.length; i++) {
                        var obj = {};
                        var columns = rows[i].querySelectorAll('[data-settings-subkey]');
                        for (var j = 0; j < columns.length; j++) {
                            var val = columns[j].value;
                            if (columns[j].type === 'number')
                                val = parseFloat(val);
                            obj[columns[j].dataset['settingsSubkey']] = val;
                        }
                        list.push(obj);
                    }
                    settings.set(key, list);
                }
            });

            var children;
            if (description) {
                children = [description, newElement('br')];
            } else {
                children = undefined;
            }
            var rowDiv = newElement('div', {className: 'ue_right'}, children);

            var rowContainer = newElement('div');
            rowContainer.dataset['settingsKey'] = key;
            rowContainer.className = 'row_container';
            if (options['onSave'] !== null)
                rowContainer.addEventListener('deliciousSave', options['onSave']);
            if (description)
                rowContainer.style.marginTop = '5px';
            rowDiv.appendChild(rowContainer);

            var current = this.get(key, options['default']);
            for (var i = 0; i < current.length; i++) {
                rowContainer.appendChild(
                    this._createRow(current[i], columns, options['allowSort'],
                        options['allowDelete']));
            }

            if (options['allowNew']) {
                var newButton = newElement('button', {textContent: options['newButtonText'], title: 'New'});
                newButton.style.marginTop = '8px';
                newButton.addEventListener('click', function(ev) {
                    rowContainer.appendChild(
                        settings._createRow({}, columns,
                            options['allowSort'],
                            options['allowDelete']));
                    ev.preventDefault();
                    ev.stopPropagation();
                });
                rowDiv.appendChild(newButton);
            }

            var li = newElement('li', {}, [
                newElement('span', {className: 'ue_left strong'}, [label]),
                rowDiv
            ]);

            return li;
        },



        showErrorMessage: function(message, errorId) {
            var errorDiv = newElement('div', {className: 'error_message'},
                [message]);
            if (errorId) {
                errorDiv.dataset['errorId'] = errorId;
                var existing = document.querySelector('[data-error-id="'+errorId+'"');
                if (existing)
                    existing.parentNode.removeChild(existing);
            }
            var thinDiv = document.querySelector('div.thin');
            thinDiv.parentNode.insertBefore(errorDiv, thinDiv);
            return errorDiv;
        },
    };


    settings.ensureSettingsInserted();

    settings.addScriptCheckbox('ABQuickLinks', 'Quick Links', 'Adds quick links to the main navbar.');
    settings.addScriptCheckbox('ABQuickLinks2', 'Quick Links 2.0', 'Adds quick links to the main navbar.');
    settings.addScriptCheckbox('ABQuickLinks3', 'AA Quick Links 2.0', 'Adds quick links to the main navbar.');
    settings.addScriptCheckbox('ABQuickLinks4', 'ZZ Quick Links 2.0', 'Adds quick links to the main navbar.');

    var s = settings.addScriptSection('ABDynamicStylesheets', 'Dynamic Stylesheets', 'Automatically changes stylesheets.');

    s.appendChild(settings.createCheckbox('TEST', 'The label', 'Does things'));

    var c = settings.createCheckbox('', 'Error test', 'Will throw an error if ticked', {
        onSave: function(ev) {
            if (ev.target.checked) {
                settings.showErrorMessage('Error thrown.', 'testId');
                ev.preventDefault();
            }
        }
    });
    settings.addBasicSetting(c);
    settings.addBasicSetting(
        settings.createTextField('ABTestText', 'Text field', 'description', {
            default: 1234,
            lineBreak: false,
        })
    );
    settings.addBasicSetting(
        settings.createDropDown('dropdownkey', 'A drop down', 'Drops down some things',
            [['Text', '1'], ['Value', '2'], ['This', '3']], {
                default: '2',
            })
    );
    settings.addBasicSetting(
        settings.createNumberInput('numberkey', 'An integer', 'Whole numbers!', {
        default: 2,
        lineBreak: true,
        })
    );

    settings.addBasicSetting(
        settings.createFieldSetSetting('ABFieldSet', 'A Field Set',
            [['Privacy', 'privacy'],
                ['Security', 'secur2ity']],
            'Some description',
            {
                'default': ['secur2ity']
            }
        )
    );

    settings.init('ABRowSetting', [
        {href: 'google.com', text: 'Goodle'}
    ]);

    settings.addBasicSetting(
        settings.createRowSetting('ABRowSetting', 'Bookmarks', [['Number', 'num', 'number'], ['Text', 'text', 'text'], ['Link', 'href', 'text']],
        '', {
        newButtonText: '+ New row'})
    );

    settings.addScriptSection('ABDynamicStyleasheets', 'Adynamic Stylesheets', 'Automatically changes stylesheets.');

    return {
        settings: settings,
        utilities: utilities
    };
})();