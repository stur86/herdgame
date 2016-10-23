var gulp = require('gulp');
var sass = require('gulp-sass');
var browserSync = require('browser-sync');
var autoprefixer = require('gulp-autoprefixer');
var exec = require('child_process').exec;

gulp.task('browserify', function (cb) {
  exec('browserify js/*.js -o app/js/bundle.js',
        function (err, stdout, stderr) {
            console.log(stdout);
            console.log(stderr);
            cb(err);
        });
});

// A simple reload task for html files
gulp.task('reload-html', function() {
    return gulp.src('app/**/*.html')
        .pipe(browserSync.reload({
            stream: true
        }));
});

// SASS processing task
autopref_opt = {
    'browsers': ['> 1%']
};

gulp.task('sass', function() {
    return gulp.src('app/scss/**/*.scss')
        .pipe(sass())
        .pipe(autoprefixer(autopref_opt))
        .pipe(gulp.dest('app/css'))
        .pipe(browserSync.reload({
            stream: true
        }));
});

// Browser sync test
gulp.task('browserSync', function() {
  browserSync.init({
    server: {
      baseDir: 'app'
    },
  })
});

// Watch task
gulp.task('watch', ['browserSync'], function(){
  gulp.watch('app/scss/**/*.scss', ['sass']); 
  gulp.watch(['app/**/*.html',
              'app/js/**/*.js'], ['reload-html']);
  gulp.watch('js/**/*.js', ['browserify']);
  // Other watchers
});

// Copy all required dependencies to app/js
gulp.task('copyJS', function() {
  return gulp.src(['node_modules/d3/build/d3.min.js',
                   'node_modules/d3-voronoi/build/d3-voronoi.min.js',
                   'node_modules/poisson-disc-sampler/poisson-disc-sampler.js'])
    .pipe(gulp.dest('app/js'));
});
