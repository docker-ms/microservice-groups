'use strict';

const CommonImport = require('../../util/CommonImport');

class CreateGroupImpl {

  static createGroup(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    CommonImport.utils.bluebirdRetryExecutor(() => {
      return usersCollection.find({
        userId: {
          $in: call.request.memberUserIds
        },
        userStatus: CommonImport.protos.enums.userStatuses.ACTIVE
      }).toArray();
    }, {}).then((res) => {
      if (res.length < call.request.memberUserIds.length) {
        return CommonImport.Promise.reject(new CommonImport.errors.ResourceNotFound.ActiveUserNotFound());
      } else if (res.length > call.request.memberUserIds.length) {
        return CommonImport.Promise.reject(new CommonImport.errors.DirtyDataDetected.DirtyUserDataDetected());
      } else {
        const groupsCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.groupsCollectionName);
        const epochNow = +new Date();
        const members = call.request.memberUserIds.reduce((acc, curr) => {
          acc[curr] = {
            joinInAt: epochNow
          };
          return acc;
        }, {});
        return CommonImport.utils.bluebirdRetryExecutor(() => {
          groupsCollection.insertOne({
            groupId: call.request.groupId,
            groupName: call.request.groupName,
            creator: call.request.creatorUserId,
            managers: [call.request.creatorUserId],
            members: members,
            lastUpdate: epochNow,
            createAt: epochNow,
            tester: call.request.tester
          });
        }, {});
      }
    }).then(() => {
      callback(null, {success: true});
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = CreateGroupImpl;


