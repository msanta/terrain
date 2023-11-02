/**
 * Class for working with the device's position.
 */
class DevicePosition
{
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

    /**
     * The geo watch position ID.
     */
    #geo_watch_id = null;

    /**
     * Flag indicating if position is being watched.
     */
    #geo_watch_enabled = false;

    /**
     * State of the GPS. Can either be starting, receiving or off.
     */
    state = 'off';

    /**
     * A function to call when geolocation is initialised.
     */
    on_init = undefined;

    /**
     * A function to call on position update.
     */
    on_update = undefined;

    /**
     * A function to call when geolocation is stopped.
     */
    on_stop = undefined;

    /**
     * A function to call on error.
     */
    on_error = undefined;

    /**
     * @param {Function} on_init The function to call when geolocation is initalised.
     * @param {Function} on_update The function to call on a position update.
     * @param {Function} on_stop The function to call when geolocation is stopped.
     * @param {Function} on_error The function to call on error.
     */
    constructor(on_init = undefined, on_update = undefined, on_stop = undefined, on_error = undefined)
    {
        this.on_init = on_init;
        this.on_update = on_update;
        this.on_stop = on_stop;
        this.on_error = on_error;
    }

    /**
     * Start geolocation.
     */
    init_geolocation()
    {
        if(!navigator.geolocation) {
            console.error('Geolocation is not supported by your browser');
            alert('Goelocation is not supported by your browser');
            this.state = 'off'
        }
        else
        {
            // this.#debug_to_el('Locating...');
            let self = this;
            this.state = 'starting';
            this.#geo_watch_id = navigator.geolocation.watchPosition(
                (position) => self.#loc_success(position),
                (error) => self.#loc_error(error),
                {enableHighAccuracy: true}
            );
            if (this.on_init) this.on_init(this);
            this.#geo_watch_enabled = true;
        }
    }
    
    #loc_success(position)
    {
        if(this.#geo_watch_enabled === false)
        {
            this.stop_geolocation();
            return;
        }
        this.state = 'receiving';
        this.lat = position.coords.latitude;
        this.lon = position.coords.longitude;
        this.accuracy = position.coords.accuracy;
        this.altitude = position.coords.altitude;
        this.altitude_accuracy = position.coords.altitude_accuracy;
        this.heading = position.coords.heading;
        this.speed = position.coords.speed;
        
        if (this.on_update) this.on_update(this);
    }
    
    #loc_error(error)
    {
        if (this.on_error) this.on_error(error);
        console.error(error);
        this.stop_geolocation();
    }
    
    /**
     * Stop geolocation.
     */
    stop_geolocation()
    {
        // Note: using a flag to indicate that watching for geolocation should be stopped because clearing the watch does not always work (probably a race condition)
        navigator.geolocation.clearWatch(this.#geo_watch_id);
        this.#geo_watch_enabled = false;
        this.state = 'off';
        if (this.on_stop) this.on_stop(this);
    }

}

export {DevicePosition};