'use strict';

const os = require('os');
const cluster = require('cluster');

const grpc = require('grpc');

const CommonImport = require('./util/CommonImport');

/*
 * Constants define.
 */
global.SERVICE_TAG = process.env.SERVICE_TAG;
global.CONSUL = require('microservice-consul');
global.RELATED_MONGODB_COLLECTIONS = {
  usersCollectionName: 'Users',
  groupsCollectionName: 'Groups'
};

if (cluster.isMaster) {
  /*
   * The master process should be kept as light as it can be, that is: only do the workers management jobs and some others very necessary jobs.
   */

  const workerPortMap = {};

  const numOfWorkers = os.cpus().length;

  for (var i = 0; i < numOfWorkers; i++) {
    const port = 53547 + i;
    const worker = cluster.fork({
      port: port
    });
    workerPortMap['' + worker.process.pid] = port;
  }

  cluster.on('exit', (worker, code, signal) => {
    const oriKey = '' + worker.process.pid;
    const newWorker = cluster.fork({
      port: workerPortMap[oriKey]
    });
    workerPortMap[newWorker.process.pid] = workerPortMap[oriKey];
    delete workerPortMap[oriKey];
  });

} else {

  /*
   * Here the woker process will always be full featured.
   */
  const buildGroupsGrpcServer = () => {
    const groupsGrpcServer = new grpc.Server();
    const groups = grpc.load({root: CommonImport.protos.root, file: CommonImport.protos.groups}).microservice.groups;
    
    groupsGrpcServer.addService(groups.Groups.service, {
      healthCheck: CommonImport.utils.healthCheck,
      createGroupV1: require('./api/v1/CreateGroupImpl').createGroup,
      inviteUserToGroupV1: require('./api/v1/InviteUserToGroupImpl').inviteUserToGroup,
      leaveGroupV1: require('./api/v1/LeaveGroupImpl').leaveGroup,

      deleteGroupV1: require('./api/v1/_DeleteGroupImpl').deleteGroup
    });

    return groupsGrpcServer;
  };

  CommonImport.Promise.join(
    require('microservice-mongodb-conn-pools')(global.CONSUL.keys.mongodbGate).then((dbPools) => {
      return dbPools;
    }),
    require('microservice-email')(global.CONSUL.keys.emailGate).then((mailerPool) => {
      return mailerPool;
    }),
    CommonImport.utils.pickRandomly(global.CONSUL.agents).kv.get(global.CONSUL.keys['jwtGate']),
    buildGroupsGrpcServer(),
    (dbPools, mailerPool, jwtGateOpts, groupsGrpcServer) => {
      if (dbPools.length === 0) {
        throw new Error('None of the mongodb servers is available.');
      }
      if (mailerPool.length === 0) {
        throw new Error('None of the email servers is available.');
      }
      if (!jwtGateOpts) {
        throw new Error('Invalid gate JWT configurations.');
      }

      global.DB_POOLS = dbPools;
      global.MAILER_POOL = mailerPool;
      global.JWT_GATE_OPTS = JSON.parse(jwtGateOpts.Value);
      
      groupsGrpcServer.bind('0.0.0.0:' + process.env.port, grpc.ServerCredentials.createInsecure());
      groupsGrpcServer.start();
    }
  );

}


