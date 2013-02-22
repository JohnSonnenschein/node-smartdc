/*
 * Copyright (c) 2013, Joyent, Inc. All rights reserved.
 */

var test = require('tap').test;
var util = require('util');
var uuid = require('node-uuid');
var fs = require('fs');
var exec = require('child_process').exec;
var smartdc = require('../lib');
var sdc;

var PACKAGE, DATASET, IMAGE, MACHINE;

var TAG_KEY = 'role';
var TAG_VAL = 'unitTest';

var TAG_TWO_KEY = 'smartdc_type';
var TAG_TWO_VAL = 'none';

var META_KEY = 'foo';
var META_VAL = 'bar';

var META_CREDS = {
    'root': 'secret',
    'admin': 'secret'
};

var META_CREDS_TWO = {
    'root': 'secret',
    'admin': 'secret',
    'jill': 'secret'
};


test('setup', function (t) {
    var f = process.env.SSH_KEY || process.env.HOME + '/.ssh/id_rsa';
    var cmd = 'ssh-keygen -l -f ' +
                f + ' ' +
                '| awk \'{print $2}\'';
    var url = process.env.SDC_CLI_URL || 'http://localhost:8080';
    var user = process.env.SDC_CLI_ACCOUNT || 'test';

    fs.readFile(f, 'utf8', function (err, key) {
        t.ifError(err);

        exec(cmd, function (err2, stdout, stderr) {
            t.ifError(err2);

            sdc = smartdc.createClient({
                connectTimeout: 1000,
                logLevel: (process.env.LOG_LEVEL || 'info'),
                retry: false,
                sign: smartdc.privateKeySigner({
                    key: key,
                    keyId: stdout.replace('\n', ''),
                    user: user
                }),
                url: url,
                account: user,
                noCache: true
            });

            t.end();
        });
    });
});


// --- SSH keys tests:
function checkKey(t, key) {
    t.ok(key);
    t.ok(key.name);
    t.ok(key.fingerprint);
    t.ok(key.key);
}


test('List keys', function (t) {
    sdc.listKeys(function (err, keys) {
        t.ifError(err);
        t.ok(keys.length);
        keys.forEach(function (key) {
            checkKey(t, key);
        });
        t.end();
    }, true);
});


test('Create Key', function (t) {
    var fname = __dirname + '/.ssh/test_id_rsa.pub';
    fs.readFile(fname, 'utf8', function (err, k) {
        t.ifError(err);
        sdc.createKey({
            key: k,
            name: 'test_id_rsa'
        }, function (err2, key) {
            t.ifError(err2);
            checkKey(t, key);
            t.end();
        });

    });
});


test('Get key', function (t) {
    sdc.getKey('test_id_rsa', function (err, key) {
        t.ifError(err);
        checkKey(t, key);
        t.end();
    }, true);
});


test('Delete key', function (t) {
    sdc.deleteKey('test_id_rsa', function (err) {
        t.ifError(err);
        t.end();
    }, true);
});



// Packages:
test('list packages', function (t) {
    sdc.listPackages(function (err, pkgs) {
        t.ifError(err);
        t.ok(pkgs);
        t.ok(Array.isArray(pkgs));
        var packages = pkgs.filter(function (p) {
            return (p['default'] === 'true');
        });
        PACKAGE = packages[0];
        if (!PACKAGE) {
            console.error('Exiting because cannot find test package.');
            process.exit(1);
        }
        t.end();
    }, true);
});


test('get package', function (t) {
    sdc.getPackage(PACKAGE.id, function (err, pkg) {
        t.ifError(err);
        t.ok(pkg);
        t.ok(pkg.name);
        t.ok(pkg.disk);
        t.ok(pkg.memory);
        t.ok(pkg.id);
        t.end();
    }, true);
});


// Datasets (we need to upgrade depending on default SmartOS version):
test('list datasets', function (t) {
    sdc.listDatasets(function (err, datasets) {
        t.ifError(err);
        t.ok(datasets);
        t.ok(Array.isArray(datasets));
        var smartos = datasets.filter(function (d) {
            return (d.name === 'smartos' && d.version === '1.6.3');
        });
        t.ok(smartos[0]);
        DATASET = smartos[0];
        if (!DATASET) {
            console.error('Exiting because cannot find test dataset.');
            process.exit(1);
        }
        t.end();
    }, true);
});


test('get dataset', function (t) {
    t.ok(DATASET);
    sdc.getDataset(DATASET.id, function (err, ds) {
        t.ifError(err);
        t.ok(ds);
        t.ok(ds.name);
        t.ok(ds.version);
        t.ok(ds.os);
        t.ok(ds.id);
        t.end();
    }, true);
});


// Images (we need to upgrade depending on default SmartOS version):
test('list images', function (t) {
    sdc.listDatasets(function (err, images) {
        t.ifError(err);
        t.ok(images);
        t.ok(Array.isArray(images));
        var smartos = images.filter(function (d) {
            return (d.name === 'smartos' && d.version === '1.6.3');
        });
        t.ok(smartos[0]);
        IMAGE = smartos[0];
        if (!IMAGE) {
            console.error('Exiting because cannot find test image.');
            process.exit(1);
        }
        t.end();
    }, true);
});


test('get images', function (t) {
    t.ok(IMAGE);
    sdc.getDataset(IMAGE.id, function (err, ds) {
        t.ifError(err);
        t.ok(ds);
        t.ok(ds.name);
        t.ok(ds.version);
        t.ok(ds.os);
        t.ok(ds.id);
        t.end();
    }, true);
});


// Datacenters:
test('list datacenters', function (t) {
    sdc.listDatacenters(function (err, datacenters) {
        t.ifError(err);
        t.ok(datacenters);
        t.ok(Array.isArray(Object.keys(datacenters)));
        sdc.createClientForDatacenter('coal', function (err2, cli) {
            t.ifError(err2);
            t.ok(cli);
            t.equal(cli.account, sdc.account);
            t.ok(cli.client);
            t.end();
        }, true);
    }, true);
});

// Machines:


function checkMachine(t, m) {
    t.ok(m, 'checkMachine ok');
    t.ok(m.id, 'checkMachine id ok');
    t.ok(m.name, 'checkMachine name ok');
    t.ok(m.type, 'checkMachine type ok');
    t.ok(m.state, 'checkMachine state ok');
    t.ok(m.image, 'checkMachine image ok');
    t.ok(m.ips, 'checkMachine ips ok');
    t.ok(m.memory, 'checkMachine memory ok');
    t.ok(m.metadata, 'checkMachine metadata ok');
    t.ok(m['package'], 'checkMachine package ok');
    t.ok(typeof (m.disk) !== 'undefined');
    t.ok(typeof (m.created) !== 'undefined');
    t.ok(typeof (m.updated) !== 'undefined');
}


// This test case assumes no previous machines for the current user. Obviously,
// it is useless if that's not true.
test('empty machines list/count', function (t) {
    return sdc.countMachines(function (err, count, done) {
        t.ifError(err);
        t.equal(0, count);
        t.ok(done);
        return sdc.listMachines(function (err1, machines, done) {
            t.ifError(err1);
            t.ok(Array.isArray(machines));
            t.equal(0, machines.length);
            t.ok(done);
            t.end();
        });
    });
});


function checkMachineStatus(t, id, state, callback) {
    return sdc.getMachine(id, function (err, machine) {
        if (err) {
            if (err.statusCode && err.statusCode === 410 && state === 'deleted') {
                return callback(null, true);
            }
            return callback(err);
        }
        if ((machine.state === 'deleted' && state !== 'deleted') ||
            machine.state === 'failed') {
            return callback(new Error('Provisioning Job failed'));
        }
        console.log('Machine \'%s\' state is: %s', machine.id, machine.state);
        return callback(null, (machine ? machine.state === state : false));
    }, true);
}


function waitForMachine(t, id, state, callback) {
    console.log('Waiting for machine \'%s\' state \'%s\'', id, state);
    return checkMachineStatus(t, id, state, function (err, ready) {
        if (err) {
            return callback(err);
        }
        if (!ready) {
            return setTimeout(function () {
                waitForMachine(t, id, state, callback);
            }, (process.env.POLL_INTERVAL || 2500));
        }
        return callback(null);
    });
}


// Machine creation there we go!:
test('create machine', {
    timeout: 600000
}, function (t) {
    var opts = {
        image: IMAGE.id,
        name: 'a' + uuid().substr(0, 7)
    };

    opts['package'] = PACKAGE.id;
    opts['metadata.' + META_KEY] = META_VAL;
    opts['tag.' + TAG_KEY] = TAG_VAL;
    opts['metadata.credentials'] = META_CREDS;

    sdc.createMachine(opts, function (err, machine) {
        if (err) {
            t.ifError(err);
            console.error('Exiting because machine creation failed.');
            process.exit(1);
        }
        waitForMachine(t, machine.id, 'running', function (err1) {
            if (err1) {
                t.ifError(err1);
                console.error('Exiting because machine provisioning failed');
                process.exit(1);
            }
            MACHINE = machine;
            t.end();
        });
    });
});


test('get machine', function (t) {
    sdc.getMachine(MACHINE.id, function (err, machine) {
        t.ifError(err);
        console.log('Machine: %j', machine);
        checkMachine(t, machine);
        MACHINE = machine;
        t.end();
    }, true);
});


test('reboot machine', {
    timeout: 180000
}, function (t) {
    sdc.rebootMachine(MACHINE.id, function (err) {
        t.ifError(err);
        waitForMachine(t, MACHINE.id, 'running', function (err1) {
            t.ifError(err1);
            t.end();
        });
    });
});


test('stop machine', {
    timeout: 180000
}, function (t) {
    sdc.stopMachine(MACHINE.id, function (err) {
        t.ifError(err);
        waitForMachine(t, MACHINE.id, 'stopped', function (err1) {
            t.ifError(err1);
            t.end();
        });
    });
});


test('start machine', {
    timeout: 180000
}, function (t) {
    sdc.startMachine(MACHINE.id, function (err) {
        t.ifError(err);
        waitForMachine(t, MACHINE.id, 'running', function (err1) {
            t.ifError(err1);
            t.end();
        });
    });
});


test('delete machine', {
    timeout: 180000
}, function (t) {
    sdc.deleteMachine(MACHINE.id, function (err) {
        t.ifError(err);
        waitForMachine(t, MACHINE.id, 'deleted', function (err1) {
            t.ifError(err1);
            t.end();
        });
    });
});


test('teardown', function (t) {
    // body...
    t.end();
});