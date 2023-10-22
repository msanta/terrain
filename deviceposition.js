/**
 * Class for working with the device's position.
 */
class DevicePosition
{
    el_debug = null;

    /**
     * The current latitude.
     */
    lat = null;

    /**
     * The current longitude.
     */
    lon = null;

    /**
     * The horizontal accuracy in meters.
     */
    accuracy = -1;

    /**
     * The altitude in meters. Null if not available.
     */
    altitude = -1;

    /**
     * The altitude accuracy in meters. Null if not available.
     */
    altitude_accuracy = -1;

    /**
     * The heading
     */
    heading = -1;

    /**
     * The speed
     */
    speed = -1;

    #geo_watch_id = null;

    /**
     * Flag indicating if position is being watched.
     */
    geo_watch_enabled = false;

    /**
     * A function to call on position update.
     */
    #on_update = undefined;

    /**
     * @param {Function} on_update The function to call on a position update.
     * @param {HTMLElement} debug_element Html for displaying debugging info.
     */
    constructor(on_update, debug_element = undefined)
    {
        this.#on_update = on_update;
        this.el_debug = debug_element;
    }

    /**
     * Start geolocation.
     */
    init_geolocation()
    {
        if(!navigator.geolocation) {
            this.#debug_to_el('Geolocation is not supported by your browser');
            alert('Goelocation is not supported by your browser');
        }
        else
        {
            this.#debug_to_el('Locating...');
            let self = this;
            this.#geo_watch_id = navigator.geolocation.watchPosition(
                (position) => self.#loc_success(position),
                (error) => self.#loc_error(error),
                {enableHighAccuracy: true}
            );
            this.geo_watch_enabled = true;
        }
    }
    
    #loc_success(position)
    {
        if(this.geo_watch_enabled === false)
        {
            this.stop_geolocation();
            return;
        }
        const latitude = this.lat = position.coords.latitude;
        const longitude = this.lon = position.coords.longitude;
        const accuracy = this.accuracy = this.#round_to(position.coords.accuracy, 1);
        const altitude = this.altitude = this.#round_to(position.coords.altitude, 1);
        const altitude_accuracy = this.altitude_accuracy = this.#round_to(position.coords.altitudeAccuracy, 1);
        const heading = this.heading = this.#round_to(position.coords.heading, 1);
        const speed = this.speed = this.#round_to(position.coords.speed, 3);
    
        let output = `Latitude: ${latitude}, Longitude: ${longitude}, Accuracy: ${accuracy} m` + '<br/>';
        output += `Altitude: ${altitude} m, Altitude Accuracy: ${altitude_accuracy} m` + '<br/>';
        output += `Heading: ${heading}, Speed: ${speed} m/s`;
        
        this.#debug_to_el(output);
        this.#on_update();
        //console.log(position, output);
    }
    
    #loc_error(error)
    {
        this.#debug_to_el('Unable to retrieve your location: ' + error.message);
        alert('Unable to retrieve your location: ' + error.message);
    }
    
    /**
     * Stop geolocation.
     */
    stop_geolocation()
    {
        // Note: using a flag to indicate that watching for geolocation should be stopped because clearing the watch does not always work (probably a race condition)
        navigator.geolocation.clearWatch(this.#geo_watch_id);
        this.#debug_to_el('stopped');
        this.geo_watch_enabled = false;
        console.log('stopped geolocation');
    }

    
    // Takes a float and rounds it to the specified precision (allowed values are 0 to 4).
    #round_to(num, precision = 0)
    {
        if(num == null || num === undefined) return num;
        if(precision == 0) return Math.round(num);
        if(precision == 1) return Math.round(num * 10) / 10;
        if(precision == 2) return Math.round(num * 100) / 100;
        if(precision == 3) return Math.round(num * 1000) / 1000;
        if(precision == 4) return Math.round(num * 10000) / 10000;
        console.error('Invalid decimals value of `' + decimals + '` passed to round_to() function')
        throw "Invalid decimal precision value for 'round_to()' function";
    }

    #debug_to_el(html)
    {
        if (this.el_debug) this.el_debug.innerHTML = html;
    }
}

export {DevicePosition};