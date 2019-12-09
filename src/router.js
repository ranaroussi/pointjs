/* jshint esversion: 9 */

//! point.js - router v 0.1
//! url: https://pointjs.org
//! description: Single Page Application router
//! authors : Ran Aroussi
//! license : Apache Software License

;(((point, document) => {

    const simulateClick = (elem) => {
        // Create our event (with options)
        const evt = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        // If cancelled, don't dispatch our event
        const canceled = !elem.dispatchEvent(evt);
    };


    point.domRouterStates = {
        "*": document.body.outerHTML
    };

    const doRoute = () => {
        const ext_route = document.querySelectorAll(`[dom-route-container]`);
        ext_route.forEach((item, ix) => {
            item.addEventListener("click", (e) => {
                e.preventDefault();
                if (item.pathname == window.location.pathname && point.domRouterStates[item.pathname]) {
                    return;
                }

                window.history.pushState(
                    {}, item.pathname, item.pathname
                );

                let template, data,
                    containerId = item.getAttribute('dom-route-container'),
                    container = document.querySelectorAll(`[dom-container=${containerId}]`)[0];

                if (!container) {
                    return;
                }

                container.style.display = "none";


                const rendered = document.querySelectorAll(`*[dom-component=${containerId}]`);
                for (let i = 0; i < rendered.length; i++) {
                    rendered[i].parentNode.removeChild(rendered[i]);
                }

                if (item.hasAttribute('dom-route-html')) {
                    container.setAttribute('id', containerId);
                    template = item.getAttribute('dom-route-html');
                    if (item.hasAttribute('dom-route-json')) {
                        data = item.getAttribute('dom-route-json');
                        point.load(template, data, containerId, false);
                    }
                    else if (item.hasAttribute('dom-route-data')) {
                        data = window[item.getAttribute('dom-route-data')];
                        point.loadHTML(template, containerId, data, false);
                    }
                    else {
                        point.loadHTML(template, containerId, {}, false);
                    }

                }

                else if (item.hasAttribute('dom-route-component')) {
                    const componentId = item.getAttribute('dom-route-component');
                    const component = document.querySelectorAll(`[dom-component=${componentId}]`)[0];
                    if (!component) {
                        return;
                    }

                    template = component.cloneNode(true);
                    template.setAttribute('dom-component', containerId);
                    container.insertAdjacentHTML('beforebegin', template.outerHTML);

                    if (item.hasAttribute('dom-route-json')) {
                        data = item.getAttribute('dom-route-json');
                        point.loadJSON(data, containerId, false);
                    }
                    else if (item.hasAttribute('dom-route-data')) {
                        data = eval(item.getAttribute('dom-route-data'));
                        point.render(containerId, data, false);
                    }
                }

                point.routerTimeout = setTimeout(() => {
                    point.domRouterStates[item.pathname] = {
                        "container": containerId,
                        "template": document.querySelectorAll(`*[dom-component=${containerId}]`)[0].outerHTML,
                        "data": data,
                        "json": item.hasAttribute('dom-route-json')
                    };
                }, 2500);
            });

            if (item.pathname == window.location.pathname) {
                simulateClick(item);
            }
        });
    };


    point.route = () => {
        clearTimeout(point.routerTimeout);
        doRoute();

        window.onpopstate = () => {
            clearTimeout(point.routerTimeout);

            if (point.domRouterStates[window.location.pathname]) {
                const state = point.domRouterStates[window.location.pathname];

                const rendered = document.querySelectorAll(`[dom-rendered=${state.container}],[dom-component=${state.container}]`);
                for (let i = 0; i < rendered.length; i++) {
                    rendered[i].parentNode.removeChild(rendered[i]);
                }

                const container = document.querySelectorAll(`[dom-container=${state.container}]`)[0];
                container.insertAdjacentHTML('beforebegin', state.template);

                if (state.json) {
                    point.loadJSON(state.data, state.container, false);
                }
                else {
                    point.render(state.container, state.data, false);
                }
            } else {
                document.body.innerHTML = point.domRouterStates['*'];
                point.route();
            }
        };
    };

    point.ready(point.route);

})(window.point = window.point || {}, document));
