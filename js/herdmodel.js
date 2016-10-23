window.poissonDisc = require('poisson-disc-sampler');
window.d3 = require('d3');
window.d3.voronoi = require('d3-voronoi').voronoi;
window.$ = require('jquery');

window.HerdModel = function(svg_id) {

    // Grab the svg
    this.svg_id = svg_id;
    if (svg_id != null) {
        this.svg = d3.select(svg_id);        
    }

    this.n = 50;
    this.vaccp = 30;
    this.sickp = 15;
    this.sick_turns = 3;
    this.spread_p = 10;
    this.vacc_eff = 50;
    this.death_f = 10;
    this.speed = 1;

    this.loop = null;

    this.update_display = function() {
        this.svg.selectAll('.goon')
            .data(this.goon_stat)
            .classed('healthy', function(d) {return d == 0;})
            .classed('sick', function(d) {return d > 0;})
            .classed('vaccinated', function(d) {return d < 0;});
    }

    this.step = function(model) {
        var spreadf = model.spread_p/100.0;
        var vacceff = model.vacc_eff/100.0;

        // So, create a new status
        var new_gstat = [];
        for (var i = 0; i < model.goon_stat.length; ++ i) {
            curr_stat = model.goon_stat[i];
            if (curr_stat != null) {
                if (curr_stat > 0) {
                    // Sick; lower by one
                    curr_stat--;
                    // Get immune or die tryin'
                    if (curr_stat == 0) {
                        var deathp = Math.random();
                        if (deathp > model.death_f/100.0) {
                            curr_stat = -1;                        
                        }
                        else {
                            curr_stat = null;
                        }

                    }

                }
                else if (curr_stat <= 0) {
                    // Visit all links
                    for (var j = 0; j < model.links[i].length; ++j) {
                        // Contagion probability?
                        var risk = spreadf;
                        if (curr_stat < 0) {
                            risk *= (1-vacceff);
                        }
                        var neigh_s = model.goon_stat[model.links[i][j]];
                        if (neigh_s > 0) {
                            // Contagion risk!
                            if (Math.random() < risk) {
                                curr_stat = model.sick_turns;
                                break; // No point in going on...
                            }
                        }
                    }
                }                
            }
            new_gstat.push(curr_stat);
        }

        model.goon_stat = new_gstat;
        if (model.svg != null)
            model.update_display();
    }

    this.init = function() {

        var w = 500;
        var h = 500;
        // What's the box size?
        var box_margin = 0.05;
        var box_insize = (1-2*box_margin);
        // First remove everything
        if (this.svg != null) {        
            this.svg.selectAll('.goon').remove();
            this.svg.selectAll('.link').remove();
            w = $(this.svg_id).width()*(1-2*box_margin);
            h = $(this.svg_id).height()*(1-2*box_margin);
        }
        // Create the array of points
        this.points = [];
        this.goon_stat = [];

        var r = Math.sqrt((w*h)/(1.5*this.n));

        var sampler = poissonDisc(w, h, r);

        var newp = sampler();
        while (this.points.length < this.n && newp) {
            this.points.push([newp[0]+w*box_margin/box_insize,
                              newp[1]+h*box_margin/box_insize,
                              this.points.length]);
            this.goon_stat.push(0); // Default: healthy
            newp = sampler();
        }

        // Assign sick and vaccinated
        var vaccn = Math.round(this.vaccp/100.0*this.n);
        var sickn = Math.round(this.sickp/100.0*this.n);

        var to_assign = [];
        for (var i = 0; i < this.points.length; ++i) {
            to_assign.push(i);
        }

        for (var i = sickn; i > 0 && to_assign.length > 0; i--) {
            var rnd_i = Math.floor(Math.random()*to_assign.length);
            this.goon_stat[to_assign.splice(rnd_i,1)[0]] = this.sick_turns;
        }

        for (var i = vaccn; i > 0 && to_assign.length > 0; i--) {
            var rnd_i = Math.floor(Math.random()*to_assign.length);
            this.goon_stat[to_assign.splice(rnd_i,1)[0]] = -1;
        }

        // Calculate Delaunay triangulation
        var voronoi = d3.voronoi();

        var tris = voronoi.triangles(this.points);

        this.links = [];
        this.edges = [];

        for (var i = 0; i < this.points.length; ++i) {
            this.links.push([]);
            for (var j = 0; j < tris.length; ++j) {
                // Is this included?
                var included = false;
                for (var k = 0; k < tris[j].length; ++k) {
                    if (tris[j][k][2] == i) {
                        included = true;
                        break;
                    }
                }
                if (!included) {
                    continue;
                }
                for (var k = 0; k < tris[j].length; ++k) {
                    var link_i = tris[j][k][2];
                    if (link_i != i && this.links[i].indexOf(link_i) == -1) {
                        this.links[i].push(link_i);
                        if (link_i > i) {
                            this.edges.push([this.points[i], this.points[link_i]]);
                        }
                    }
                }
            }
        }

        if (this.svg != null) {
            this.svg.selectAll('.link')
                .data(this.edges)
                .enter()
                .append('line')
                .classed('link', true)
                .attr('x1', function(d) { return d[0][0];})
                .attr('y1', function(d) { return d[0][1];})
                .attr('x2', function(d) { return d[1][0];})
                .attr('y2', function(d) { return d[1][1];});

            this.svg.selectAll('.goon')
                    .data(this.points)
                    .enter()
                    .append('circle')
                    .classed('goon', true)
                    .attr('cx', function(d) { return d[0];})
                    .attr('cy', function(d) { return d[1];})
                    .attr('data-i', function(d) { return d[2];})
                    .attr('r', r/6.0);

            this.update_display();            
        }
    }

    this.start = function() {
        this.init();

        // And ready for update...
        this.loop = setInterval(this.step, 1000.0/this.speed, this);
    }
}

window.makeDatGui = function(model) {

    // What should be the size of the GUI?
    var w = ($(document).width()-$('.column').width())/2.0;

    var gui = new dat.GUI({'width': w});
    gui.add(model, 'n').min(30).max(300).step(1).name('Number of Goons');
    gui.add(model, 'vaccp').min(10).max(80).step(1).name('Vaccinated (%)');
    gui.add(model, 'sickp').min(1).max(20).step(1).name('Sick (%)');
    gui.add(model, 'spread_p').min(1).max(15).step(1).name('Contagion prob. (%)');
    gui.add(model, 'vacc_eff').min(20).max(90).step(1).name('Vaccine eff. (%)');
    gui.add(model, 'speed').min(0.2).max(5).name('Speed (turns/s)');
    gui.add(model, 'start');

    return gui;
}
