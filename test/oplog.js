
/**
 * Test dependencies.
 */

var oplog = require('..')
  , monk = require('monk')
  , local = monk('localhost:27017/local')
  , woot = monk('localhost:27017/test').get('woot-' + Date.now())
  , col2 = monk('localhost:27017/test').get('col-' + Date.now())
  , expect = require('expect.js');

var ts;

function create(){
  var log = oplog(local);
  if (ts) log.query({ ts: { $gt: ts } });
  if (process.env.OPLOG_TEST_RS) log.type('rs');
  log.on('op', function(o){
    // we ensure no tailers from a test get operations
    // that correspond to the test before it
    ts = o.ts;
  });
  return log;
}

describe('oplog', function(){

  it('should emit an op event', function(done){
    var log = create();
    log.on('op', function(d){
      expect(d.ns).to.match(/test\.woot/);
      expect(d.op).to.be('i');
      expect(d.o.a).to.be('b');
      log.destroy();
      done();
    });
    log.tail();
    woot.insert({ a: 'b' });
  });

  it('should emit named events', function($done){
    var log = create();
    var total = 3;
    function done() {
      log.destroy();
      $done();
    }
    log.on('remove', function(d){
      --total || done();
    });
    log.on('update', function(d){
      expect(d.o.$set.b).to.be('update');
      --total || done();
    });
    log.on('insert', function(d){
      expect(d.o.a).to.be('insert');
      --total || done();
    });
    log.tail();
    woot.insert({ a: 'insert' });
    woot.update({ a: 'insert' }, { $set: { b: 'update' } });
    woot.remove({ a: 'insert' });
  });

  it('should filter', function(done){
    var log = create();
    var opCount = 0;
    log.on('op', function(){
      opCount++;
    });
    log.filter()
      .ns('*.' + woot.name)
      .on('insert', function(o){
        expect(o.o.a).to.be('filter');
        setTimeout(function(){
          expect(opCount).to.be(2);
          done();
        }, 50);
      });
    log.tail();
    col2.insert({ b: 'insert' });
    woot.insert({ a: 'filter' });
  });

});