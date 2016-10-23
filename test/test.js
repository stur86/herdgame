#!/bin/env node

window = global;

var hm = require('../js/herdmodel.js');
var fs = require('fs');

// Initialize model
model = new HerdModel();

// Try a table of different parameters...
var step_n = 10;
model.n = 100;
model.spread_p = 5;

avg_n = 20;
avg_vals = {};
for (var avg_i = 0; avg_i < avg_n; ++avg_i)
{
    console.log("Average: " + (avg_i+1) + " of " + avg_n)
    for (var vacc_eff = 0; vacc_eff <= 100; vacc_eff += 2) {
        if (avg_vals[vacc_eff] == null)
            avg_vals[vacc_eff] = {};
        for (var vacc_pop = 0; vacc_pop <= 100; vacc_pop += 2) {
            if (avg_vals[vacc_eff][vacc_pop] == null)
                avg_vals[vacc_eff][vacc_pop] = [0.0, 0.0];

            model.vacc_eff = vacc_eff;
            model.vaccp = vacc_pop;

            model.init();
            for (var t = 0; t < step_n; ++t) {
                model.step(model);
            }

            var dead = 0;
            var sick = 0;
            for (var i = 0; i < model.goon_stat.length; ++i) {
                if (model.goon_stat[i] > 0) {
                    sick++;
                }
                else if (model.goon_stat[i] == null) {
                    dead++;
                }
            }

            avg_vals[vacc_eff][vacc_pop][0] += sick;
            avg_vals[vacc_eff][vacc_pop][1] += dead;
        }
    } 
}

var stream = fs.createWriteStream("results.dat");
stream.once('open', function(fd) {
  for (ve in avg_vals) {
    for (vp in avg_vals[ve]) {
        stream.write(ve + ' ' + vp + ' ' + avg_vals[ve][vp][0]/avg_n + ' ' + avg_vals[ve][vp][1]/avg_n + '\n');
    }
    stream.write('\n');
  }
  stream.end();
});
