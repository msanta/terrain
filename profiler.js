

class Profiler
{
    static totals = {};
    static started = {};

    constructor()
    {
        
    }

    static start_section(name)
    {
        this.started[name] = Date.now();
    }

    static end_section(name)
    {
        if (this.started[name] !== undefined)
        {
            if (this.totals[name] == undefined) this.totals[name] = 0;
            this.totals[name] += Date.now() - this.started[name];
        }
    }

    static get_totals()
    {
        return this.totals;
    }

    static clear()
    {
        this.totals = {};
    }
}

export {Profiler};