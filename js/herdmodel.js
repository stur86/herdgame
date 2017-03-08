window.poissonDisc = require('poisson-disc-sampler');
window.d3 = require('d3');
window.d3.voronoi = require('d3-voronoi').voronoi;
window.$ = require('jquery');


window.HerdModel = function(svg_id, plot_id, textbox_id) {

    // Colors
    this.colors = [
        '#ecc733',  // Healthy
        '#7f9f68',  // Sick
        '#81b8d7',  // Vaccinated
        '#000000'   // Dead
    ];

    that = this;
    this.col_func = function(d) {
        if (d == 0)
            return that.colors[0];
        else if (d > 0)
            return that.colors[1];
        else if (d < 0)
            return that.colors[2];
        else
            return that.colors[3];
    }

    // Grab the svg
    this.svg_id = svg_id;
    if (svg_id != null) {
        this.svg = d3.select(svg_id);  
    }
    this.plot_id = plot_id;
    if (plot_id != null) {
        var plotcont = d3.select(plot_id);
        var viewBox = plotcont.attr('viewBox');
        w_ext = parseInt(viewBox.split(' ')[2]);
        h_ext = parseInt(viewBox.split(' ')[3]);
        var margin = {top: 30, right: 20, bottom: 60, left: 60};
        this.plot_width = w_ext - margin.left - margin.right;
        this.plot_height = h_ext - margin.top - margin.bottom;
        this.svgplot =  plotcont.append("g")
                        .attr("transform", 
                              "translate(" + margin.left + "," + margin.top + ")");
    }
    this.textbox_id = textbox_id;
    this.textbox = $(textbox_id);

    this.n = 50;
    this.vaccp = 30;
    this.sickp = 15;
    this.sick_turns = 3;
    this.spread_p = 10;
    this.vacc_eff = 50;
    this.death_f = 10;
    this.speed = 1;

    this.plot_turns = 30;

    this.loop = null;

    this.update_display = function() {
        this.svg.selectAll('.goon')
            .data(this.goon_stat)
            .attr('fill', that.col_func)
    }

    this.step = function(model) {
        var spreadf = model.spread_p/100.0;
        var vacceff = model.vacc_eff/100.0;

        // So, create a new status
        var new_gstat = [];
        var pop_n = [0,0,0,0];
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
                    else {
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
            // Adjust population number
            if (curr_stat != null)
            {
                if (curr_stat > 0) {
                    pop_n[1]++;
                }
                else if (curr_stat == 0) {
                    pop_n[0]++;
                }
                else {
                    pop_n[2]++;
                }
            }
            else {
                pop_n[3]++;
            }
            new_gstat.push(curr_stat);
        }

        model.goon_stat = new_gstat;
        model.history.push(pop_n);
        if (model.svg != null)
            model.update_display();
        if (model.svgplot != null)
            model.plot();
        if (model.textbox[0] != null)
            model.update_text();
    
        if (pop_n[1] == 0) {
            model.stop(); // Epidemic is over
        }

    }

    this.init = function() {

        var w_ext = 1000;
        var h_ext = 600;
        // What's the box size?
        var box_margin = 0.05;
        var box_insize = (1-2*box_margin);
        // First remove everything
        if (this.svg != null) {     
            // Get box size
            var viewBox = this.svg.attr('viewBox');
            w_ext = parseInt(viewBox.split(' ')[2]);
            h_ext = parseInt(viewBox.split(' ')[3]);
            this.svg.selectAll('.goon').remove();
            this.svg.selectAll('.link').remove();
            w = w_ext*box_insize;
            h = h_ext*box_insize;
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

        this.history = [[0,0,0,0]];
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
            this.history[0][1]++;
        }

        for (var i = vaccn; i > 0 && to_assign.length > 0; i--) {
            var rnd_i = Math.floor(Math.random()*to_assign.length);
            this.goon_stat[to_assign.splice(rnd_i,1)[0]] = -1;
            this.history[0][2]++;
        }

        this.history[0][0] = to_assign.length;

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

        // Init plot
        if (this.svgplot != null) {
            this.plotx = d3.scaleLinear().rangeRound([0, this.plot_width]);
            this.ploty = d3.scaleLinear().rangeRound([this.plot_height, 0])
                                         .domain([0, this.n]);

            // Clean existing lines
            this.svgplot.selectAll('*').remove();

            this.plotlines = [];

            var that = this;
            var makeyfunc = function(i) {
                return function(d, j) { return that.ploty(d[i]);};
            }            
            for (var i = 0; i < 4; ++i) {
                this.plotlines.push(
                    [this.svgplot.append('path')    // Path
                        .attr('id', 'line_'+i)
                        .classed('plot-line', true)
                        .attr('stroke', this.colors[i]),
                     d3.line()
                       .x(function(d, j) { return that.plotx(j);})
                       .y(makeyfunc(i))
                    ]
                    );
            }

            this.svgplot.append("g")
              .attr("class", "axis axis--x")
              .attr("transform", "translate(0," + this.plot_height + ")");
            this.svgplot.append("g")
              .attr("class", "axis axis--y")
              .call(d3.axisLeft(this.ploty));

            this.plot();
            this.update_text();
        }

    }

    this.start = function() {
        // Stop anything still running...
        this.stop();

        this.init();

        // And ready for update...
        this.loop = setInterval(this.step, 1000.0/this.speed, this);
    }

    this.stop = function() {
        if (this.loop != null) {
            clearInterval(this.loop);
        }
    }

    this.plot = function() {

        if (this.plotx == null)
            return;

        this.plotx.domain([0, this.plot_turns-1]);

        var hist_slice = this.history.slice(Math.max(this.history.length-this.plot_turns, 0),
                                            Math.max(this.history.length, this.plot_turns))
        for (var i = 0; i < 4; ++i) {
            this.plotlines[i][0].attr('d', this.plotlines[i][1](hist_slice));
        }

        this.plotx.domain([Math.max(this.history.length-this.plot_turns, 0),
                           Math.max(this.history.length-1, this.plot_turns-1)]);
        this.svgplot.select('.axis--x').call(d3.axisBottom(this.plotx));

    }

    this.update_text = function(status) {
        var labels = ['healthy', 'sick', 'immune', 'dead'];
        status = status || this.history[this.history.length-1];
        for (var i = 0; i < labels.length; ++i) {
            this.textbox.find('#n_' + labels[i]).html(status[i]);
        }
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
    gui.add(model, 'sick_turns').min(1).max(6).step(1).name('Sickness turns');
    gui.add(model, 'speed').min(0.2).max(5).name('Speed (turns/s)');
    gui.add(model, 'death_f').min(5).max(40).name('Mortality (%)');
    gui.add(model, 'plot_turns').min(5).max(40).step(1).name('Plotted history').onFinishChange(function() {model.plot();});
    gui.add(model, 'start').name('Start');
    gui.add(model, 'stop').name('Stop');
    gui.close();

    // Create Waypoint for it to appear
    var wayp = new Waypoint({
      element: $(model.svg_id)[0],
      handler: function(direction) {
        if (direction == 'down') {
            gui.open();
        }
        else {
            gui.close();
        }
      },
      offset: '50%'
    });

    return gui;
}

