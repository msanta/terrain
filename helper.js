
import * as UTM from './geodesy/utm.js';


class Helper
{
    /**
     * Converts a latitude and longitude into UTM.
     * @param {number} lat 
     * @param {number} lon 
     * @param {number} zone The UTM zone that the location is in. Make sure this is the same as the Project's zone or the returned values will be off the Project's map.
     * @return {object} Object containing the easting, northing and zone values.
     */
    static convert_latlon_to_utm(lat, lon, zone)
    {
        let latlon = new UTM.LatLon(lat, lon);
        let utm = latlon.toUtm(zone);
        return {zone: utm.zone, easting: utm.easting.toFixed(0), northing: utm.northing.toFixed(0)};
    }
}

export {Helper};