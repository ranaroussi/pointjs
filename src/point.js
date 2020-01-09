/* jshint esversion: 9 */

//! point.js v 0.2
//! url: https://pointjs.org
//! description: A fast, lightweight, client-side Javascript template framework
//! authors : Ran Aroussi
//! license : Apache Software License


;(((point, document) => {

    const isArray = (input) => {
        return Object.prototype.toString.call(input) === '[object Array]';
    };

    // --- hide template ---
    point.ready = (callback) => {
        const removeListener = document.removeEventListener || document.detachEvent;
        const eventName = document.addEventListener ? "DOMContentLoaded" : "onreadystatechange";
        const addListener = document.addEventListener || document.attachEvent;
        if (["complete", "loaded", "interactive"].indexOf(document.readyState) !== -1) {
            callback(document, event);
        } else {
            addListener.call(document, eventName, function (event) {
                removeListener(eventName, arguments.callee, false);
                callback(event);
            }, false);
        }
    };
    point.ready(() => {
        document.head.insertAdjacentHTML('beforeend', '<style> [point-component] { display: none; } </style>');
    });


    const returnPromise = (error) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                ((!error) ? resolve : reject)({ error: error });
            }, 5);
        });
    }

    // allow outside writing of modifiers
    const ext_modifiers = {};
    point.modifier = (modifier, callback) => {
        ext_modifiers[modifier] = callback;
    };

    const get_contitions = (template) => {
        let statement, cond, conditions = [];
        const statement_regex = /\{\{if(.*?)\}\}(.*?)\{\{\/if\}\}/gms;
        const cond_regex = /\{\{if (.*?)\}\}/gm;
        while ((statement = statement_regex.exec(template)) !== null) {
            // avoid infinite loops with zero-width matches
            if (statement.index === statement_regex.lastIndex) { statement_regex.lastIndex++; }
            while ((cond = cond_regex.exec(statement[0])) !== null) {
                if (cond.index === cond_regex.lastIndex) { cond_regex.lastIndex++; }
                let values = statement[2].split('{{if:else}}');
                conditions.push([statement[0], cond[0], values[0], (values.length > 1) ? values[1] : ""]);
            }
        }
        return conditions;
    };

    const run_modifiers = (value, modifiers, undefined) => {
        if (value === ' ' || value === '' || value === undefined || value === null || value === 'null') {
            if (modifiers[0] === "no_null") {
                return '-';
            }
            if (modifiers[0] === "hidden_if_empty") {
                return 'hidden';
            }
            return '';
        }

        if (!modifiers || modifiers.length == 0) {
            return value;
        }

        value = value.toString();

        for (let i = 0; i < modifiers.length; i++) {
            const modifier = modifiers[i].toLowerCase();

            if (modifier === "capitalize") value = value.toLowerCase().replace(/^.|\s\S/g, a => a.toUpperCase());
            if (modifier === "uppercase") value = value.toUpperCase();
            if (modifier === "lowercase") value = value.toLowerCase();
            if (modifier === "nl2br") value = value.replace(/(\r\n|\n|\r)/gm, "<br>");
            if (modifier === "nozero" && value.toString() === "0") value = "";
            if (modifier === "clean_url") {
                value = value.split("://");
                if (value.length === 2) {
                    value = value[1];
                } else {
                    value = value[0];
                }
                value = value.replace("www.", "");
                if (value.slice(0 - 1) == '/') {
                    value = value.substring(0, value.length - 1);
                }
            }
            if (modifier === "unix2date") value = new Date(value * 1000);
            if (modifier === "format_number") value = format_number(value, 2).replace('.00', '');
            if (modifier === "format_decimal") value = format_number(value, 2);
            if (modifier === "format_number_as_word") value = format_number_as_word(value);
            if (modifier === "format_int") value = format_number(value, 0);
            if (modifier === "format_percent") value = format_number(value * 100, 2) + '%';

            if (modifier === "checked") {
                if (value == true || value == 'true' || value == 1 || value == "1") {
                    value = " checked";
                }
            }
            if (modifier === "negative_checked") {
                if (value == false || value == 'false' || value == -1 || value == "-1") {
                    value = " checked";
                }
            }

            if (modifier === "selected") {
                if (value == true || value == 'true' || value == 1 || value == "1") {
                    value = " selected";
                }
            }
            if (modifier === "negative_selected") {
                if (value == false || value == 'false' || value == -1 || value == "-1") {
                    value = " selected";
                }
            }

            if (modifier === "link") {
                let replacedText;
                let replacePattern1;
                let replacePattern2;
                let replacePattern3;

                // URLs starting with http://, https://, or ftp://
                replacePattern1 = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gim;
                replacedText = value.replace(replacePattern1, '<a href="$1" target="_blank">$1</a>');

                // URLs starting with "www." (without // before it, or it'd re-link the ones done above).
                replacePattern2 = /(^|[^\/])(www\.[\S]+(\b|$))/gim;
                replacedText = replacedText.replace(replacePattern2, '$1<a href="http://$2" target="_blank">$2</a>');

                // Change email addresses to mailto:: links.
                replacePattern3 = /(([a-zA-Z0-9\-\_\.])+@[a-zA-Z\_]+?(\.[a-zA-Z]{2,6})+)/gim;
                replacedText = replacedText.replace(replacePattern3, '<a href="mailto:$1">$1</a>');

                value = replacedText;
            }

            // external modifiers
            if (ext_modifiers.hasOwnProperty(modifier)) {
                value = ext_modifiers[modifier](value);
            }
        }

        // return
        return value;
    };

    const single = (template, data) => {

        // run conditions
        const conditions = get_contitions(template);
        for (let i = 0; i < conditions.length; i++) {
            let cond,
                statement = conditions[i][0],
                condition = conditions[i][1],
                match = conditions[i][2],
                nomatch = conditions[i][3];

            const regex = /if (\w+)[\s+](\!=|<>|>=|<=|=+)[\s+]/gm;
            while ((cond = regex.exec(condition)) !== null) {
                if (cond.index === regex.lastIndex) { regex.lastIndex++; }
                let word = cond[1];
                let new_cond = process(condition.replace(word, '"{{' + word + '}}"'), data);
                // new_cond = new_cond.replace('window.', '');
                // new_cond = new_cond.replace('document.', '');
                new_cond = new_cond.replace(' == true', ' == "true"').replace(' == false', ' == "false"');
                let matched = eval(new_cond.replace('{{if ', '(').replace('}}', ')'));
                template = template.replace(statement, (matched) ? match : nomatch);
            }
        }

        // run normal
        return process(template, data);
    };


    const process = (template, data) => {
        return template.replace(/\{\{([\w\|\.\(\)]*)\}\}/g, (str, raw_key) => {
            const key = raw_key.split('|')[0];
            const modifiers = raw_key.split('|').splice(1);
            const keys = key.split(".");
            let values = data[keys.shift()];

            // nested items
            for (let i = 0, l = keys.length; i < l; i++) {
                try {
                    values = values[keys[i]];
                } catch (error) {
                    values = '';
                }
            }

            // pass through modifiers
            values = run_modifiers(values, modifiers);

            return (typeof values !== "undefined" && values !== null) ? values: "";
        });
    };

    const loop = (template, data) => {
        const template_items = [];
        for (let i = 0; i < data.length; i++) {
            template_items.push(single(template, data[i]));
        }
        return template_items.join('');
    };

    point.loadExternal = (url, callback) => {
        let xhr = new XMLHttpRequest();
        callback = callback || function(){};
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                callback(xhr.responseText.trim());
            }
        };
        xhr.open('GET', url);
        xhr.send();
    };

    const loadHTML = (remote_template, dom_placement, data, observe) => {

        let templateId, mode;

        if (document.getElementById(dom_placement)) {
            mode = "element";
            dom_placement = document.getElementById(dom_placement);
        }
        else if (document.querySelectorAll(`*[point-component=${dom_placement}]`)[0]) {
            mode = "component";
            dom_placement = document.querySelectorAll(`*[point-component=${dom_placement}]`)[0];
        }
        point.loadExternal(remote_template, (tpl) => {
            if (tpl.indexOf('point-component') === -1) {
                templateId = dom_placement.id || 'tjs' + Date.now();
                tpl = `<div point-component="${templateId}">${tpl}</div>`;
            } else {
                templateId = tpl.split('point-component=')[1].replace(/\'|\"/gm, '').split(' ')[0];
            }

            dom_placement.insertAdjacentHTML('beforebegin', tpl);

            if (observe == false) {
                return point.render(templateId, data, false);
            }
            return point.attach(templateId, data, false);
        });
    };

    const loadJSON = (remote_json, templateId, observe) => {
        point.loadExternal(remote_json, (data) => {
            remote_json = JSON.parse(data);

            if (!templateId) {
                return remote_json;
            }

            if (observe == false) {
                return point.render(templateId, remote_json, false);
            }
            return point.attach(templateId, remote_json, false);
        });
    };

    const loadRemote = (remote_template, remote_json, dom_placement, observe) => {
        point.loadExternal(remote_json, (data) => {
            return loadHTML(remote_template, dom_placement, JSON.parse(data), observe);
        });
    };

    point.attachHTML = (remote_template, dom_placement, data) => {
        return loadHTML(remote_template, dom_placement, data, true);
    };

    point.renderHTML = (remote_template, dom_placement, data) => {
        return loadHTML(remote_template, dom_placement, data, false);
    };

    point.attachJSON = (remote_json, templateId) => {
        let error = loadJSON(remote_json, templateId, true);
        return returnPromise(error);
    };

    point.renderJSON = (remote_json, templateId) => {
        let error = loadJSON(remote_json, templateId, false);
        return returnPromise(error);
    };

    point.attachRemote = (remote_template, remote_json, dom_placement, observe) => {
        let error = loadRemote(remote_template, remote_json, dom_placement, observe, true);
        return returnPromise(error);
    };

    point.renderRemote = (remote_template, remote_json, dom_placement, observe) => {
        let error = loadRemote(remote_template, remote_json, dom_placement, observe, false);
        return returnPromise(error);
    };


    point.render = (templateId, data, promise) => {
        let error = false;
        try {
            data = data || {};

            // read template element
            const template_obj = document.querySelectorAll(`*[point-component=${templateId}]`)[0];
            if (!template_obj) return;

            // show template element
            document.querySelectorAll(`*[point-component=${templateId}]`)[0].style.display = "";

            // remove previously rendered template
            const rendered = document.querySelectorAll(`*[point-rendered=${templateId}]`);
            for (let i = 0; i < rendered.length; i++) {
                rendered[i].parentNode.removeChild(rendered[i]);
            }

            // get template html from template element
            let template_html = template_obj.outerHTML
                .replace(`point-component='${templateId}'`, `point-rendered="${templateId}"`)
                .replace(`point-component="${templateId}"`, `point-rendered="${templateId}"`);


            // ------------------------
            // input/textarea binding
            if (template_html.indexOf('point-bind') !== -1) {
                template_obj.querySelectorAll('[point-bind]').forEach((model) => {
                    const item = model.getAttribute('point-bind');
                    template_html = template_html.replace('{{'+item+'}}', '<point for="'+item+'">{{'+item+'}}</point>');
                });
                // input/textarea binding
                let regex = /<input(.*?)point-bind="(.*?)"(.*?)>/gmi;
                let subst = `<input$1point-bind="$2" value="{{$2}}"$3>`;
                template_html = template_html.replace(regex, subst);
                regex = /<textarea(.*?)point-bind="(.*?)"(.*?)><textarea>/gmi;
                subst = `<textarea$1point-bind="$2"$3>{{$2}}</textarea>`;
                template_html = template_html.replace(regex, subst);
            }
            // ------------------------

            // parse html container
            let parsed_html = '';

            // data must be an array
            if (!isArray(data)) data = [data];

            // parse
            if (data.length <= 1) {
                parsed_html = single(template_html, data[0]);
            } else {
                parsed_html = loop(template_html, data);
            }

            template_obj.insertAdjacentHTML('beforebegin', parsed_html);

            // activate tooltip for bootstrap
            const tooltips = document.querySelectorAll('*[data-toggle="tooltip"]');
            for (let i = 0; i < tooltips.length; i++) {
                tooltips[i].tooltip();
            }

            // prevent linkage for pretty-select
            try {
                prettySelect.renderLinks();
            } catch (er) { }

            // hide template element (for future use)
            document.querySelectorAll(`*[point-component=${templateId}]`)[0].style.display = "none";


        } catch (err) {
            error = err;
        }


        // ------------------------
        // input/textarea binding
        const component = document.querySelector(`[point-rendered="${templateId}"]`);
        const models = component.querySelectorAll('[point-bind]');
        models.forEach((model) => {
            const model_name = model.getAttribute('point-bind');
            if (point.$[templateId][model_name]) {
                model.addEventListener('keyup', (event) => {
                    setTimeout(() => {
                        component.querySelectorAll(`point[for=${model_name}]`).forEach((item) => {
                            item.innerHTML = model.value;
                        })
                    }, 10);
                });
                model.addEventListener('blur', (event) => {
                    point.$[templateId][model_name] = model.value;
                });
            }
        });
        // ------------------------



        if (promise === false) {
            return error;
        }

        return returnPromise(error);
    };

    // access un-declated data
    point.$ = {};
    point.attach = (templateId, object) => {

        // access un-declated data
        point.$[templateId] = object;

        const filter = (o) => {
            if (typeof o == "object" && isArray(o)) {
                return o.filter(()=>{return true;});
            }
            return o;
        }

        const _observe = (o) => {

            const callback = (changes) => {
                // console.log("Changes: ", changes);

                if (changes[0].type == "add") {
                    object = filter(changes[0]);
                    _observe(object[object.length-1]);
                }
                else if (changes[0].type == "delete") {
                    object = filter(changes[0]);
                    Object.unobserve(changes[0].oldValue, callback);
                }
                else {
                    object = filter(object);
                }

                point.render(templateId, object, false);
            };

            for (var k in o) {
                item = o[k];
                if (typeof item == "object" && item !== null) {
                    _observe(item);
                }
            }
            Object.observe(o, callback);
        };

        let error = point.render(templateId, object, false);

        _observe(object);

        return returnPromise(error);
    };


    // format number
    const format_number = (no, decimals) => {
        no = parseFloat(no);
        decimals = (decimals === undefined) ? 2 : decimals;
        no = no.toFixed(decimals) + '';
        x = no.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        const rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    };

    const format_number_as_word = (num) => {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
        }
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        }
        return num;
    };

})(window.point = window.point || {}, document));

// =================================================================

/*!
 * Object.observe "lite" polyfill - v0.2.4
 * by Massimo Artizzu (MaxArt2501)
 *
 * https://github.com/MaxArt2501/object-observe
 *
 * Licensed under the MIT License
 * See LICENSE for details
 */

Object.observe || (function(O, A, root, _undefined) {
    "use strict";

    let observed, handlers,
        defaultAcceptList = ["add", "update", "delete", "reconfigure", "setPrototype", "preventExtensions"];

    const isArray = (input) => {
        return Object.prototype.toString.call(input) === '[object Array]';
    };

    const inArray = A.indexOf || function(array, pivot, start) {
        for (var i = start || 0; i < array.length; i++)
        if (array[i] === pivot)
            return i;
        return -1;
    };

    var createMap = root.Map === _undefined || !Map.prototype.forEach ? function() {
            var keys = [], values = [];

            return {
                size: 0,
                has: function(key) {
                    // console.log('has')
                    return inArray(keys, key) > -1;
                },
                get: function(key) {
                    // console.log('get')
                    return values[inArray(keys, key)];
                },
                set: function(key, value) {
                    // console.log('set')
                    var i = inArray(keys, key);
                    if (i === -1) {
                        keys.push(key);
                        values.push(value);
                        this.size++;
                    } else values[i] = value;
                },
                delete: function(key) {
                    // console.log('delete')
                    var i = inArray(keys, key);
                    if (i > -1) {
                        keys.splice(i, 1);
                        values.splice(i, 1);
                        this.size--;
                    }
                },
                forEach: function(callback) {
                    for (var i = 0; i < keys.length; i++)
                        callback.call(arguments[1], values[i], keys[i], this);
                }
            };
        } : function() {
            return new Map();
        },

        getProps = O.getOwnPropertyNames ? (function() {
            var func = O.getOwnPropertyNames;
            try {
                return arguments.callee;
            } catch (e) {

                var avoid = (func(inArray).join(" ") + " ").replace(/prototype |length |name /g, "").slice(0, -1).split(" ");
                if (avoid.length) func = function(object) {
                    var props = O.getOwnPropertyNames(object);
                    if (typeof object === "function")
                        for (var i = 0, j; i < avoid.length;)
                            if ((j = inArray(props, avoid[i++])) > -1)
                                props.splice(j, 1);

                    return props;
                };
            }
            return func;
        })() : function(object) {
            var props = [],
                prop, hop;
            if ("hasOwnProperty" in object) {
                for (prop in object)
                    if (object.hasOwnProperty(prop))
                        props.push(prop);
            } else {
                hop = O.hasOwnProperty;
                for (prop in object)
                    if (hop.call(object, prop))
                        props.push(prop);
            }

            if (isArray(object))
                props.push("length");

            return props;
        },

        nextFrame = root.requestAnimationFrame || root.webkitRequestAnimationFrame || (function() {
            var initial = +new Date(),
                last = initial;
            return function(func) {
                return setTimeout(function() {
                    func((last = +new Date()) - initial);
                }, 17);
            };
        })(),

        doObserve = function(object, handler, acceptList) {
            var data = observed.get(object);

            if (data) {
                performPropertyChecks(data, object);
                setHandler(object, data, handler, acceptList);
            } else {
                data = createObjectData(object);
                setHandler(object, data, handler, acceptList);

                if (observed.size === 1)
                    nextFrame(runGlobalLoop);
            }
        },

        createObjectData = function(object, data) {
            var props = getProps(object),
                values = [],
                i = 0;
            data = {
                handlers: createMap(),
                properties: props,
                values: values,
                notifier: retrieveNotifier(object, data)
            };

            while (i < props.length)
                values[i] = object[props[i++]];

            observed.set(object, data);

            return data;
        },

        performPropertyChecks = function(data, object, except) {
            if (!data.handlers.size) return;

            var props, proplen, keys,
                values = data.values,
                i = 0,
                idx,
                key, value, ovalue;

            props = data.properties.slice();
            proplen = props.length;
            keys = getProps(object);

            while (i < keys.length) {
                key = keys[i++];
                idx = inArray(props, key);
                value = object[key];

                if (idx === -1) {
                    addChangeRecord(object, data, {
                        name: key,
                        type: "add",
                        object: object
                    }, except);
                    data.properties.push(key);
                    values.push(value);
                } else {
                    ovalue = values[idx];
                    props[idx] = null;
                    proplen--;
                    if (ovalue === value ? ovalue === 0 && 1 / ovalue !== 1 / value :
                        ovalue === ovalue || value === value) {
                        addChangeRecord(object, data, {
                            name: key,
                            type: "update",
                            object: object,
                            oldValue: ovalue
                        }, except);
                        data.values[idx] = value;
                    }
                }
            }

            for (i = props.length; proplen && i--;)
                if (props[i] !== null) {
                    addChangeRecord(object, data, {
                        name: props[i],
                        type: "delete",
                        object: object,
                        oldValue: values[i]
                    }, except);
                    data.properties.splice(i, 1);
                    data.values.splice(i, 1);
                    proplen--;
                }
        },

        runGlobalLoop = function() {
            if (observed.size) {
                observed.forEach(performPropertyChecks);
                handlers.forEach(deliverHandlerRecords);
                nextFrame(runGlobalLoop);
            }
        },

        deliverHandlerRecords = function(hdata, handler) {
            var records = hdata.changeRecords;
            if (records.length) {
                hdata.changeRecords = [];
                handler(records);
            }
        },

        retrieveNotifier = function(object, data) {
            if (arguments.length < 2)
                data = observed.get(object);

            return data && data.notifier || {
                notify: function(changeRecord) {
                    changeRecord.type;

                    var data = observed.get(object);
                    if (data) {
                        var recordCopy = {
                                object: object
                            },
                            prop;
                        for (prop in changeRecord)
                            if (prop !== "object")
                                recordCopy[prop] = changeRecord[prop];
                        addChangeRecord(object, data, recordCopy);
                    }
                },

                performChange: function(changeType, func) {
                    if (typeof changeType !== "string")
                        throw new TypeError("Invalid non-string changeType");

                    if (typeof func !== "function")
                        throw new TypeError("Cannot perform non-function");

                    var data = observed.get(object),
                        prop, changeRecord,
                        thisObj = arguments[2],
                        result = thisObj === _undefined ? func() : func.call(thisObj);

                    data && performPropertyChecks(data, object, changeType);

                    if (data && result && typeof result === "object") {
                        changeRecord = {
                            object: object,
                            type: changeType
                        };
                        for (prop in result)
                            if (prop !== "object" && prop !== "type")
                                changeRecord[prop] = result[prop];
                        addChangeRecord(object, data, changeRecord);
                    }
                }
            };
        },

        setHandler = function(object, data, handler, acceptList) {
            var hdata = handlers.get(handler);
            if (!hdata)
                handlers.set(handler, hdata = {
                    observed: createMap(),
                    changeRecords: []
                });
            hdata.observed.set(object, {
                acceptList: acceptList.slice(),
                data: data
            });
            data.handlers.set(handler, hdata);
        },

        addChangeRecord = function(object, data, changeRecord, except) {
            data.handlers.forEach(function(hdata) {
                var acceptList = hdata.observed.get(object).acceptList;
                if ((typeof except !== "string" ||
                        inArray(acceptList, except) === -1) &&
                    inArray(acceptList, changeRecord.type) > -1)
                    hdata.changeRecords.push(changeRecord);
            });
        };

    observed = createMap();
    handlers = createMap();

    O.observe = (object, handler, acceptList) => {
        if (!object || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.observe cannot observe non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.observe cannot deliver to non-function");

        if (O.isFrozen && O.isFrozen(handler))
            throw new TypeError("Object.observe cannot deliver to a frozen function object");

        if (acceptList === _undefined)
            acceptList = defaultAcceptList;
        else if (!acceptList || typeof acceptList !== "object")
            throw new TypeError("Third argument to Object.observe must be an array of strings.");

        doObserve(object, handler, acceptList);

        return object;
    };

    O.unobserve = (object, handler) => {
        if (object === null || typeof object !== "object" && typeof object !== "function")
            throw new TypeError("Object.unobserve cannot unobserve non-object");

        if (typeof handler !== "function")
            throw new TypeError("Object.unobserve cannot deliver to non-function");

        var hdata = handlers.get(handler), odata;

        if (hdata && (odata = hdata.observed.get(object))) {
            hdata.observed.forEach(function(odata, object) {
                performPropertyChecks(odata.data, object);
            });
            nextFrame(function() {
                deliverHandlerRecords(hdata, handler);
            });

            if (hdata.observed.size === 1 && hdata.observed.has(object))
                handlers["delete"](handler);
            else hdata.observed["delete"](object);

            if (odata.data.handlers.size === 1)
                observed["delete"](object);
            else odata.data.handlers["delete"](handler);
        }

        return object;
    };

})(Object, Array, this);
