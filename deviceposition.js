/**
 * Class for working with the device's position.
 */
class DevicePosition
{
    el_debug = null;
    /**
     * The current latitude.
     */
    cur_lat = null;
    /**
     * The current longitude.
     */
    cur_lon = null;
    geo_watch_id = null;
    geo_watch_enabled = false;

    /**
     * 
     * @param {HTMLElement} debug_element Html for displaying debugging info.
     */
    constructor(debug_element = undefined)
    {
        this.el_debug = debug_element;
    }

    /**
     * Start geolocation.
     */
    init_geolocation()
    {
        //el_debugloc = document.getElementById('debugloc');
        if(!navigator.geolocation) {
            this.#debug_to_el('Geolocation is not supported by your browser');
            alert('Goelocation is not supported by your browser');
        }
        else
        {
            this.#debug_to_el('Locating...');
            let self = this;
            this.geo_watch_id = navigator.geolocation.watchPosition(
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
        const latitude = this.cur_lat = position.coords.latitude;
        const longitude = this.cur_lon = position.coords.longitude;
        const accuracy = this.#round_to(position.coords.accuracy, 1);
        const altitude = this.#round_to(position.coords.altitude, 1);
        const altitude_accuracy = this.#round_to(position.coords.altitudeAccuracy, 1);
        const heading = this.#round_to(position.coords.heading, 1);
        const speed = this.#round_to(position.coords.speed, 3);
    
        let output = `Latitude: ${latitude}, Longitude: ${longitude}, Accuracy: ${accuracy} m` + '<br/>';
        output += `Altitude: ${altitude} m, Altitude Accuracy: ${altitude_accuracy} m` + '<br/>';
        output += `Heading: ${heading}, Speed: ${speed} m/s`;
        
        this.#debug_to_el(output);
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
        navigator.geolocation.clearWatch(this.geo_watch_id);
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