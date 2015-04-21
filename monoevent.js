/*
* MonoEvent Beta
* Event library for mobile
* Copyright (c) Yiguo Chan
* Released under the MIT Licenses
*
* Mail : chenmnkken@gmail.com
* Date : 2015-04-21
*/

(function( define, window ){

define(function(){

'use strict';

var eventProps = 'attrChange attrName relatedNode srcElement altKey bubbles cancelable ctrlKey currentTarget eventPhase metaKey relatedTarget shiftKey target timeStamp view which touches changedTouches fireData'.split( ' ' ),

    isIOS = !!~navigator.userAgent.toLowerCase().indexOf('iphone os'),
    doubleTapSetupCount = 0,
    eventHooks = {};

var Event = function( event ){
    // 无new实例化
    if( !(this instanceof Event) ){
        return new Event( event );
    }

    if( event && event.type ){
        this.originalEvent = event;
        this.type = event.type;

        this.isDefaultPrevented = ( event.defaultPrevented ||
            event.getPreventDefault && event.getPreventDefault() ) ? true : false;
    }
    else{
        this.type = event;
    }

    this.timeStamp = event && event.timeStamp || Date.now();
};

Event.prototype = {

    // 模拟DOM LV2的阻止默认事件的方法
    preventDefault : function(){
        // DOM LV3
        this.isDefaultPrevented = true;
        var e = this.originalEvent;

        if( e ){
            e.preventDefault();
        }
    },

    // 模拟DOM LV2阻止事件冒泡的方法
    stopPropagation : function(){
        // DOM LV3
        this.isPropagationStopped = true;
        var e = this.originalEvent;

        if( e ){
            e.stopPropagation();
        }
    },

    // 模拟DOM LV3阻止同类型事件冒泡的方法
    stopImmediatePropagation : function(){
        this.isImmediatePropagationStopped = true;
        this.stopPropagation();
    },

    // 判定是否阻止了默认事件
    isDefaultPrevented : false,

    // 判定是否阻止了冒泡
    isPropagationStopped : false,

    // 判定是否阻止了同类型事件的冒泡
    isImmediatePropagationStopped : false

};

eventHooks.tap = {

    types : [ 'touchstart', 'touchend' ],

    setup : function( options ){
        var originalHandle = options.handle,
            startTx, startTy,

            handles = {

                touchstart : function( e ){
                    var touches = e.touches[0];

                    startTx = touches.clientX;
                    startTy = touches.clientY;
                },

                touchend : function( e ){
                    var touches = e.changedTouches[0],
                        endTx = touches.clientX,
                        endTy = touches.clientY;

                    e.type = options.type;

                    if( Math.abs(startTx - endTx) < 6 && Math.abs(startTy - endTy) < 6 ){
                        originalHandle.call( this, e );
                    }
                }

            };

        ne.addSpecialEvent( options, handles, this.types, originalHandle );
    },

    teardown : function( options ){
        this.types.forEach(function( item ){
            var newOptions = ne.mergeOptions( options, item, true );
            ne.removeEvent( newOptions );
        });
    }

};

eventHooks.doubleTap = {

    types : [ 'touchstart', 'touchend', 'click' ],

    setup : function( options ){
        var originalHandle = options.handle,
            firstTouchEnd = true,
            lastTime = 0,
            lastTx = null,
            lastTy = null,
            startTx, startTy, dTapTimer, startTime,

            handles = {

                touchstart : function( e ){
                    if( dTapTimer ){
                        clearTimeout( dTapTimer );
                        dTapTimer = null;
                    }

                    var touches = e.touches[0];

                    startTx = touches.clientX;
                    startTy = touches.clientY;
                },

                touchend : function( e ){
                    var touches = e.changedTouches[0],
                        endTx = touches.clientX,
                        endTy = touches.clientY,
                        now = Date.now(),
                        duration = now - lastTime;

                    e.type = options.type;

                    if( Math.abs(startTx - endTx) < 6 && Math.abs(startTy - endTy) < 6 ){
                        if( duration < 501 ){
                            if( lastTx !== null &&
                                Math.abs(lastTx - endTx) < 45 &&
                                Math.abs(lastTy - endTy) < 45 &&
                                (!options.selector || e.isFake || ne.existDoubleTap(this, e.target, options.selector)) ){

                                firstTouchEnd = true;
                                lastTx = lastTy = null;
                                delete e.isFake;
                                originalHandle.call( e.target, e );
                            }
                        }
                        else{
                            lastTx = endTx;
                            lastTy = endTy;
                        }
                    }
                    else{
                        firstTouchEnd = true;
                        lastTx = lastTy = null;
                    }

                    lastTime = now;
                }

            },

            bodyHandles = {
                touchstart : function(){
                    startTime = Date.now();
                },

                touchend : function( e ){
                    var noLongTap = Date.now() - startTime < 501,
                        handles;

                    if( firstTouchEnd ){
                        firstTouchEnd = false;
                        if( noLongTap ){
                            handles = ne.existDoubleTap( this, e.target, options.selector );

                            if( Array.isArray(handles) ){
                                dTapTimer = setTimeout(function(){
                                    handles.forEach(function( item ){
                                        e.isFake = true;
                                        item.handle( e );
                                    });

                                    firstTouchEnd = true;
                                    lastTx = lastTy = null;
                                }, 400 );
                            }
                        }
                    }
                    else{
                        firstTouchEnd = true;
                    }
                }
            };

        if( isIOS ){
            handles.click = function(){
                if( dTapTimer ){
                    clearTimeout( dTapTimer );
                    dTapTimer = null;
                    firstTouchEnd = true;
                }
            };

            if( !doubleTapSetupCount ){
                [ 'touchstart', 'touchend' ].forEach(function( item ){
                    ne.addEvent({
                        elems : [ document.body ],
                        type : item,
                        dataName : item,
                        namespace : 'likedoubleTap',
                        capture : true,
                        handle : bodyHandles[ item ]
                    });
                });
            }
        }

        ne.addSpecialEvent( options, handles, this.types, originalHandle );
    },

    teardown : function( options ){
        this.types.forEach(function( item ){
            var newOptions = ne.mergeOptions( options, item, true );

            ne.removeEvent( newOptions );
        });

        if( isIOS && !doubleTapSetupCount ){
            [ 'touchstart', 'touchend' ].forEach(function( item ){
                ne.removeEvent({
                    elems : [ document.body ],
                    type : item,
                    dataName : item,
                    namespace : 'likedoubleTap',
                    capture : true
                });
            });
        }
    }
};

eventHooks.longTap = {

    types : [ 'touchstart', 'touchmove', 'touchend' ],

    setup : function( options ){
        var originalHandle = options.handle,
            startTx, startTy, lTapTimer,

            clearTimer = function(){
                clearTimeout( lTapTimer );
                lTapTimer = null;
            },

            handles = {

                touchstart : function( e ){
                    if( lTapTimer ){
                        clearTimer();
                    }

                    var touches = e.touches[0],
                        self = this;

                    startTx = touches.clientX;
                    startTy = touches.clientY;
                    e.type = options.type;

                    lTapTimer = setTimeout(function(){
                        originalHandle.call( self, e );
                    }, 750 );

                    e.preventDefault();
                },

                touchmove : function( e ){
                    var touches = e.touches[0],
                        moveTx = touches.clientX,
                        moveTy = touches.clientY;

                    if( lTapTimer && (Math.abs(moveTx - startTx) > 5 || Math.abs(moveTy - startTy) > 5) ){
                        clearTimer();
                    }
                },

                touchend : function(){
                    if( lTapTimer ){
                        clearTimer();
                    }
                }

            };

        ne.addSpecialEvent( options, handles, this.types, originalHandle );
    }

};

eventHooks.swipe = {

    types : [ 'touchstart', 'touchmove', 'touchend' ],

    setup : function( options ){
        var originalHandle = options.handle,
            startTx, startTy, isTouchMove,

            handles = {

                touchstart : function( e ){
                    var touches = e.touches[0];

                    startTx = touches.clientX;
                    startTy = touches.clientY;
                    isTouchMove = false;
                },

                touchmove : function( e ){
                    isTouchMove = true;
                },

                touchend : function( e ){
                    if( !isTouchMove ){
                        return;
                    }

                    var touches = e.changedTouches[0],
                        endTx = touches.clientX,
                        endTy = touches.clientY,
                        distanceX = startTx - endTx,
                        distanceY = startTy - endTy,
                        isSwipe = false;

                    e.type = options.type;

                    if( Math.abs(distanceX) >= Math.abs(distanceY) ){
                        if( distanceX > 20 ){
                            isSwipe = true;
                            if( options.type === 'swipeLeft' ){
                                originalHandle.call( this, e );
                            }
                        }
                        else if( distanceX < -20 ){
                            isSwipe = true;
                            if( options.type === 'swipeRight' ){
                                originalHandle.call( this, e );
                            }
                        }
                    }
                    else{
                        if( distanceY > 20 ){
                            isSwipe = true;
                            if( options.type === 'swipeUp' ){
                                originalHandle.call( this, e );
                            }
                        }
                        else if( distanceY < -20 ){
                            isSwipe = true;
                            if( options.type === 'swipeDown' ){
                                originalHandle.call( this, e );
                            }
                        }
                    }

                    if( isSwipe && options.type === 'swipe' ){
                        originalHandle.call( this, e );
                    }
                }

            };

        ne.addSpecialEvent( options, handles, this.types, originalHandle );
    }

};

eventHooks.longTap.teardown = eventHooks.swipe.teardown = eventHooks.tap.teardown;
eventHooks.swipeLeft = eventHooks.swipeRight = eventHooks.swipeUp = eventHooks.swipeDown = eventHooks.swipe;

var ne = {

    cache : {},

    uuid : 2,

    guid : Date.now() + ( Math.random() + '' ).slice( -8 ),

    isWindow : function( obj ){
        return obj && obj === obj.window;
    },

    // 判断是否为空对象
    isEmptyObject : function( obj ){
        var name;
        for( name in obj ){
            return false;
        }
        return true;
    },

    /*
     * 判断一个DOM元素是否绑定了doubleTap事件
     * @param { HTMLElement } 代理元素
     * @param { HTMLElement } 触发事件的目标元素
     * @param { String } 事件代理的选择器
     * @return { Array/Boolean } 绑定了doubleTap事件则返回事件handles数组，否则返回false
     */
    existDoubleTap : function( elem, target, selector ){
        var filter = ne.delegateFilter,
            dataName = 'special_' + ( selector ? selector + '_' : '' ) + 'doubleTap_touchend',
            flag = false,
            data;

        while( target ){
            if( selector ){
                data = ne.data( elem, dataName );

                if( filter(target, selector) ){
                    flag = true;
                }
            }
            else{
                data = ne.data( target, dataName );

                if( Array.isArray(data) ){
                    flag = true;
                }
            }

            if( flag ){
                return data;
            }
            else{
                target = target.parentNode;
            }
        }

        return false;
    },

    /*
     * 根据原来的事件配置对象创建一个新的对象
     * @param { Object } 原事件配置对象
     * @param { String } 新的事件类型
     * @param { Boolean } 是否卸载
     * @return { Object } 返回新创建的对象
     */
    mergeOptions : function( source, type, isTeardown ){
        var target = {
            type : type,
            elems : source.elems,
            selector : source.selector,
            extraData : source.extraData,
            originalType : source.type,
            namespace : source.namespace,
            dataName : ( source.selector ? source.selector + '_' : '' ) + type
        };

        if( isTeardown ){
            target.handle = source.handle;
        }

        return target;
    },

    /*
     * 获取和设置元素的缓存索引值，小于3的索引值都是为特殊元素准备的
     * window 的索引为 0，document 的索引为 1，
     * document.documentElement 的索引为2
     * @param { HTMLElement }
     * @param { Boolean } 为ture的时如果元素没有索引值将创建一个
     * @return { Number } 返回元素的索引值
     */
    getCacheIndex : function( elem, isSet ){
        if( elem.nodeType === 1 ){
            var guid = ne.guid;

            return !isSet || guid in elem ?
                elem[ guid ] :
                ( elem[ guid ] = ++ne.uuid );
        }

        return ne.isWindow( elem ) ? 0 :
            elem.nodeType === 9 ? 1 :
            elem.tagName === 'HTML' ? 2 : -1;
    },

    /*
     * 写入/获取缓存
     * @param { HTMLElement }
     * @param { String } 缓存的key
     * @param { Anything } 缓存的值
     * @return { Anything } 缓存的值
     */
    data : function( elem, name, val ){
        var isUndefined = val === undefined,
            index = ne.getCacheIndex( elem, !isUndefined ),
            _cache, result;

        if( index !== undefined ){
            if( !(index in ne.cache) && !isUndefined ){
                ne.cache[ index ] = {};
            }

            _cache = ne.cache[ index ];

            if( !_cache ){
                return;
            }

            result = _cache[ name ];

            if( isUndefined || result !== undefined ){
                return result;
            }

            if( !isUndefined ){
                _cache[ name ] = val;
                return val;
            }
        }
    },

    /*
     * 移除缓存
     * @param { HTMLElement }
     * @param { String } 缓存的一级命名空间
     * @param { String } 缓存的key
     */
    removeData : function( elem, name ){
        var index = ne.getCacheIndex( elem ),
            _cache;

        if( index in ne.cache ){
            // 有参数就删除指定的数据
            _cache = ne.cache[ index ];
            if( name ){
                delete _cache[ name ];
            }

            if( ne.isEmptyObject(_cache) ){
                delete ne.cache[ index ];
            }

            // 索引值小于3都无需删除DOM元素上的索引值
            if( index < 3 ){
                return;
            }

            // 缓存中无数据了则删除DOM元素上的索引值
            if( _cache === undefined ){
                try{
                    delete elem[ ne.guid ];
                }
                catch( _ ){
                    elem.removeAttribute( ne.guid );
                }
            }
        }
    },

    /*
     * 添加特殊事件的handle缓存
     * @param { HTMLElement }
     * @param { Function } 原事件处理器
     * @param { Object } 配置对象
     * @param { Object } 用于模拟各种类型的事件处理器
     */
    addSpecialData : function( elem, originalHandle, options, handles ){
        var specialName, specialData, name, item;

        if( options.type === 'doubleTap' ){
            doubleTapSetupCount++;
        }

        for( name in handles ){
            specialName = 'special_' + ( options.selector ? options.selector + '_' : '' ) + options.type + '_' + name;
            specialData = ne.data( elem, specialName, [] );

            specialData.push({
                originalHandle : originalHandle,
                handle : handles[ name ]
            });
        }
    },

    /*
     * 将Nodelist转换成真实数组
     * @param { Nodelist }
     * @return { Array } 真实的数组
     */
    makeArray : function( source, target ){
        target = target || [];

        var i = 0,
            len = source.length;

        if( source !== null && source !== undefined ){
            if( Array.isArray(source) && Array.isArray(target) && !target.length ){
                return source;
            }

            for( ; i < len; i++ ){
                target[ target.length++ ] = source[i];
            }
        }

        return target;
    },

    /*
     * 绑定事件的内部方法
     * @param { Object } 参数集合
     * elems : DOM 数组
     * selector : 事件代理的选择器
     * type : 事件类型
     * dataName : 缓存事件处理器的key
     * handle : 事件处理器
     * capture : 是否捕获
     * extraData : 附加数据
     * namespace : 命名空间
     */
    addEvent : function( options ){
        var capture = options.capture === undefined ? false : options.capture,
            selector = options.selector,
            dataName = options.dataName,
            elems = options.elems,
            len = elems.length,
            i = 0,
            handles, eventHandle, elem,
            eventData = {
                type : options.originalType || options.type,
                handle : options.handle
            };

        if( options.namespace ){
            eventData.namespace = options.namespace;
        }

        if( options.extraData ){
            eventData.extraData = options.extraData;
        }

        for( ; i < len; i++ ){
            elem = elems[i];
            handles = this.data( elem, dataName, [] );

            // 将事件处理器添加到缓存的数组中，待统一执行
            handles.push( eventData );

            // 确保该元素只绑定一次同类型的事件
            if( handles.length === 1 ){
                // 生成一个统一的事件处理方法
                eventHandle = ne.eventHandle( elem, selector );
                // 然后将该方法也缓存到数组的第一个索引中，方便之后的事件卸载
                handles.unshift({ handle : eventHandle });

                elem.addEventListener( options.type, eventHandle, capture );
            }
        }
    },

    /*
     * 卸载事件的内部方法
     * @param { Object } 参数集合 参数解说同addEvent
     */
    removeEvent : function( options ){
        var capture = options.capture === undefined ? false : options.capture,
            namespace = options.namespace,
            dataName = options.dataName,
            handle = options.handle,
            elems = options.elems,
            type = options.originalType || options.type,
            len = elems.length,
            nameArr = dataName.split( '_' ),
            i = 0,
            // specialName的命名规则是 'special_' + 原生的事件类型
            // dataName有可能带有选择器的的前缀
            specialName = 'special_' +
                ( options.selector ? options.selector + '_' : '' ) +
                options.originalType + '_' +
                nameArr[ nameArr.length - 1 ],

            handles, result, specialHandles, specialHandle, elem, j;

        for( ; i < len; i++ ){
            elem = elems[i];
            handles = this.data( elem, dataName );

            if( handles ){
                specialHandles = this.data( elem, specialName );

                // 卸载指定的事件处理器
                for( j = 1; j < handles.length; j++ ){
                    result = handles[j];

                    if( specialHandles ){
                        specialHandle = specialHandles[ j - 1 ];

                        if( specialHandle && specialHandle.originalHandle === handle ){
                            handle = specialHandle.handle;
                        }
                    }

                    if( result.type === type &&
                        (!namespace || result.namespace === namespace) &&
                        (!handle || result.handle === handle) ){

                        handles.splice( j, 1 );

                        if( specialHandles ){
                            specialHandles.splice( j - 1, 1 );
                        }

                        if( options.originalType === 'doubleTap' && dataName === 'touchend' ){
                            doubleTapSetupCount--;
                        }

                        if( handle ){
                            break;
                        }

                        j--;
                    }
                }

                // 没有指定函数名或只剩下一个【统一的事件处理器】将卸载所有的事件处理器
                if( handles.length === 1 ){
                    // 卸载统一的事件处理器
                    elem.removeEventListener( options.type, handles[0].handle, capture );

                    // 删除缓存中的该事件类型的所有数据
                    this.removeData( elem, dataName );

                    if( specialHandles ){
                        this.removeData( elem, specialName );
                    }
                }
            }
        }
    },

    addSpecialEvent : function( options, handles, types, originalHandle ){
        var len = options.elems.length,
            i = 0;

        for( ; i < len; i++ ){
            ne.addSpecialData( options.elems[i], originalHandle, options, handles )
        }

        types.forEach(function( item ){
            var newOptions = ne.mergeOptions( options, item );

            if( handles[item] ){
                newOptions.handle = handles[ item ];
                ne.addEvent( newOptions );
            }
        });
    },

    /*
     * 模拟事件触发器
     * @param { HTMLElement }
     * @param { String } 事件类型
     * @param { Array } 事件处理器的数组
     * @param { String } 命名空间
     * @param { Array } 附加参数
     */
    fireEvent : function( elem, type, namespace, fireData ){
        var i = 1,
            handles = this.data( elem, type ),
            len, event, parent, result, isPropagationStopped;

        if( handles ){
            // 修正Event对象
            event = {
                target : elem,
                currentTarget : elem,
                type : type,
                stopPropagation : function(){
                    isPropagationStopped = true;
                }
            };

            if( fireData ){
                event.fireData = fireData;
            }

            if( !namespace ){
                handles[0].handle.call( elem, event );
            }
            else{
                len = handles.length;
                for( ; i < len; i++ ){
                    result = handles[i];
                    if( result.namespace === namespace ){
                        result.handle.call( elem, event );
                    }
                }
            }

            parent = elem.parentNode;
            // 模拟事件冒泡
            if( parent && !isPropagationStopped ){
                this.fireEvent( parent, type, null, namespace, fireData );
            }
        }
    },

    /*
     * 事件代理的DOM元素过滤器，判断是否符合 selector 的匹配
     * @param { HTMLElement }
     * @param { String } 基本类型的选择器( tag, class, id )
     * @return { Boolean } 是否匹配
     */
    delegateFilter : function( elem, selector ){
        var tagName, className, name, index;
        // class
        if( ~selector.indexOf('.') ){
            className = elem.className;
            index = selector.indexOf( '.' );
            name = ' ' + selector.substring( index + 1 ) + ' ';
            tagName = selector.substring( 0, index ).toUpperCase();
            return (!tagName || elem.tagName === tagName) && (className && !!~(' ' + className + ' ').indexOf(name));
        }
        // id
        if( ~selector.indexOf('#') ){
            index = selector.indexOf( '#' );
            name = selector.substring( index + 1 );
            tagName = selector.substring( 0, index ).toUpperCase();
            return (!tagName || elem.tagName === tagName) && (elem.id === name);
        }
        // tag
        return elem.tagName.toLowerCase() === selector;
    },

    // 模拟一个可写的、统一的Event接口对象，该对象包含了常见的标准属性和方法。
    createEvent : function( event ){
        var sourceEvent = event,
            target = event.target,
            len = eventProps.length,
            i = 0,
            type;

        // 创建Event对象
        event = Event( sourceEvent );
        // 将原生的Event的某些常见的标准属性合并到新Event中
        for( ; i < len; i++ ){
            event[ eventProps[i] ] = sourceEvent[ eventProps[i] ];
        }

        type = event.type;
        return event;
    },

    /*
     * 生成一个统一的事件处理器，来依次执行该元素绑定的所有事件处理器
     * @param { HTMLElement }
     * @param { String/Function } 事件代理的选择器或事件处理器(若为事件处理器将不予理会)
     * @return { Function }
     */
    eventHandle : function( elem, selector ){
        return function( event ){
            event = ne.createEvent( event );

            var orginalTarget = event.target,
                fireData = event.fireData,
                isDelegate = false,
                type = event.type,
                target = elem,
                dataName = type,
                i = 1,
                handles, len, j, filter, result, name;

            if( !event.currentTarget ){
                event.currentTarget = ne.data( orginalTarget, 'currentTarget' ) || elem;
            }

            // 如果有 selector 则用 target 与 selector 进行匹配，匹配成功才执行事件处理器
            // 这就是事件代理的简单原理，利用事件冒泡的特性
            if( selector ){
                filter = ne.delegateFilter;
                // 事件代理时将 this 指向 event.target，否则默认指向 elem
                target = orginalTarget;
                // 选择器 + 事件类型的方式来区分事件代理
                dataName = selector + '_' + type;

                for( ; target !== elem; target = target.parentNode || elem ){
                    if( filter(target, selector) ){
                        isDelegate = true;
                        break;
                    }
                }
            }

            if( !selector || isDelegate ){
                handles = ne.data( elem, dataName );

                if( handles ){
                    len = handles.length;

                    for( ; i < len; i++ ){
                        // 针对只执行一次即卸载的事件的特殊处理
                        j = handles[i] ? i : i - 1;
                        result = handles[j];

                        // 将缓存的附加数据添加到event对象中
                        if( result.extraData || fireData ){
                            if( result.extraData ){
                                event.extraData = {};

                                for( name in result.extraData ){
                                    event.extraData[ name ] = result.extraData[ name ];
                                }
                            }

                            if( fireData ){
                                event.extraData = {};

                                for( name in fireData ){
                                    event.extraData[ name ] = fireData[ name ];
                                }
                            }

                            try{
                                event.originalEvent.fireData = null;
                                delete event.originalEvent.fireData;
                            }
                            catch( _ ){};

                            delete event.fireData;
                        }
                        // 附加数据不能共享以确保不冲突
                        else{
                            delete event.extraData;
                        }

                        if( result.handle.call(target, event) === false ){
                            event.preventDefault();
                            event.stopPropagation();
                        }
                    }
                }
            }
        };
    }

};

var init = function( selector, context ){
    var elems;
    this.length = 0;

    if( !selector ){
        return this;
    }

    // selector为字符串
    if( typeof selector === 'string' ){
        selector = selector.trim();
        context = context || document;
        elems = context.querySelectorAll( selector, context );
        return ne.makeArray( elems, this );
    }

    // selector为DOM节点、document、document.documentElement
    if( selector.nodeType || ne.isWindow(selector) ){
        this[0] = selector;
        this.length = 1;
        return this;
    }

    // selector为Nodelist
    if( typeof selector.length === 'number' ){
        return ne.makeArray( selector, this );
    }
};

var MonoEvent = function( selector, context ){
    return new init( selector, context );
};

init.prototype = MonoEvent.prototype;

// 绑定和卸载事件供外部调用的原型方法的拼装
[{ methodName : 'on', aliasName : 'setup' },
  { methodName : 'un', aliasName : 'teardown' }].forEach(function( item ){

    MonoEvent.prototype[ item.methodName ] = function( type, selector, extraData, fn, one ){
        var types = type.match( /[^\s]+/g ),
            len = types.length,
            isOn = item.methodName === 'on',
            isOne = isOn && one === true,
            options = {},
            i = 0,
            special, dataName, originalFn;

        if( len === 1 ){
            type = types[0];
            types = type.split( '.' );
            type = types[0];
            options.namespace = types[1];
            special = eventHooks[ type ];
            dataName = type;
        }
        // 多个事件类型循环绑定或卸载
        else{
            for( ; i < len; i++ ){
                this[ isOne ? 'one' : item.methodName ]( types[i], selector, extraData, fn );
            }
            return this;
        }

        // 处理相关的参数
        if( !fn ){
            if( selector ){
                if( typeof selector === 'function' ){
                    fn = selector;
                    selector = extraData = null;
                }
                else if( typeof selector === 'object' ){
                    fn = extraData;
                    extraData = selector;
                    selector = null;
                }
                else if( typeof selector === 'string' ){
                    fn = extraData;
                    // 事件代理时缓存的name格式为：选择器 + '_' + 事件类型 => '.demo_click'
                    dataName = selector + '_' + type;
                    extraData = null;
                }
            }
            else if( extraData ){
                if( typeof extraData === 'function' ){
                    fn = extraData;
                    extraData = null;
                }
            }
        }
        else if( typeof selector === 'string' ){
            dataName = selector + '_' + type;
        }

        // one方法的实现，执行真正的事件处理器前先卸载该事件
        if( isOne ){
            originalFn = fn;
            fn = function( e ){
                var originalEvent = e.originalEvent,
                    args = [ e ];

                MonoEvent( e.currentTarget ).un( type, selector, fn );
                originalFn.apply( this, args );
            };
        }

        options.elems = this;
        options.type = type;
        options.handle = fn;
        options.dataName = dataName;
        options.selector = selector;
        options.extraData = extraData;

        // 特殊事件的绑定和卸载分支
        if( special && special[item.aliasName] ){
            special[ item.aliasName ]( options );
        }
        else{
            ne[ isOn ? 'addEvent' : 'removeEvent' ]( options );
        }

        return this;
    };

});

MonoEvent.prototype.fire = function( type, fireData ){
    var types = type.split( '.' ),
        namespace = types[1],
        len = this.length,
        i = 0,
        special;

    type = types[0];
    special = eventHooks[ type ];

    if( special && special.trigger ){
        special.trigger( this, namespace, fireData );
        return this;
    }

    for( ; i < len; i++ ){
        ne.fireEvent( this[i], type, namespace, fireData );
    }

    return this;
};

MonoEvent.prototype.one = function( type, selector, extraData, fn ){
    return this.on( type, selector, extraData, fn, true );
};

window.MonoEvent = MonoEvent;

});

})( typeof define === 'function' && (define.amd || define.cmd) ? define :
    function ( name, deps, factory ) {
        if( typeof name === 'function' ){
            factory = name;
        }

        if( typeof deps === 'function' ){
            factory = deps;
        }

        if( factory ){
            factory();
        }
    }
, window );
