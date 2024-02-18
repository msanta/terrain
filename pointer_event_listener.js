/**
 * Class for listening to pointer events on a given element. This allows listening for click, double click and long presses. When these events are detected the class will dispatch the events to all registered event listeners.
 */
class PointerEventListener
{
    /**
     * The DOM element to listen to.
     */
    #element;

    /**
     * Long press timeout
     */
    #long_press_timeout;

    /**
     * Records the last two times when the pointer state changed to 'down'.
     */
    #pointer_down_time;
    
    /**
     * 
     */
    #event_handlers;

    /**
     * 
     * @param {HTMLElement} element The element to listen on. 
     */
    constructor(element)
    {
        this.#element = element;
        this.#pointer_down_time = [0, 0];
        this.#event_handlers = {};

        element.addEventListener('pointerdown', (e) => this.#handle_pointer_down(e));
        element.addEventListener('pointerup', (e) => this.#handle_pointer_up(e));
        element.addEventListener('pointermove', (e) => this.#handle_pointer_move(e));
    }
    
    /**
     * Adds an event listener
     * @param {string} event 
     * @param {function} callback 
     */
    add_event_listener(event, callback)
    {
        if (this.#event_handlers[event] == undefined) this.#event_handlers[event] = [];
        if (this.#event_handlers[event].indexOf(callback) == -1) this.#event_handlers[event].push(callback);
    }

    /**
     * Removes an event listener
     * @param {string} event 
     * @param {function} callback 
     */
    remove_event_listener(event, callback)
    {
        if (this.#event_handlers[event])
        {
            let index = this.#event_handlers[event].indexOf(callback);
            if (index != -1) this.#event_handlers[event].splice(index, 1);
            if (this.#event_handlers[event].length == 0) delete this.#event_handlers[event];
        }
    }


    #handle_pointer_down(e)
    {
        if (!e.isPrimary) 
        {
            clearTimeout(this.#long_press_timeout);     // more than one pointer means that a long press should not be fired.
            return;
        }

        this.#pointer_down_time[1] = this.#pointer_down_time[0];
        this.#pointer_down_time[0] = Date.now();
        // Check the duration since the last down event to determine if this is a double click/tap
        if (this.#pointer_down_time[0] - this.#pointer_down_time[1] < 350)
        {
            //console.info('pointer dbl down');
            this.#dispatch_event('dbl_down', e);
            clearTimeout(this.#long_press_timeout);
        }
        else
        {
            //console.info('pointer down', e);
            this.#dispatch_event('down', e);
            this.#long_press_timeout = setTimeout(() => this.#long_press(e), 1000);
        }
        
    }

    #handle_pointer_up(e)
    {
        if (!e.isPrimary) return;
        //console.info('pointer up');
        clearTimeout(this.#long_press_timeout);
    }

    #handle_pointer_move(e)
    {
        if (!e.isPrimary) return;
        //console.info('pointer move');
        clearTimeout(this.#long_press_timeout);
    }

    #long_press(e)
    {
        this.#dispatch_event('long_press', e);
        //console.log('long press!', e);
    }

    /**
     * Dispatches an event by calling all registered callbacks.
     * @param {string} event The event to dispatch
     * @param {object} params The parameters object to pass to the callback
     */
    #dispatch_event(event, params)
    {
        if (this.#event_handlers[event])
        {
            for (let func of this.#event_handlers[event])
            {
                func(params);
            }
        }
    }
}

export {PointerEventListener};
