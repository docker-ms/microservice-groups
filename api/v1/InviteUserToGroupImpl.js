'use strict';

const CommonImport = require('../../util/CommonImport');

const ApiUtil = require('../../util/ApiUtil');

class InviteUserToGroupImpl {

  static inviteUserToGroup(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const usersCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.usersCollectionName);

    CommonImport.utils.bluebirdRetryExecutor(() => {
      return usersCollection.find({
        userId: {
          $in: [call.request.inviterUserId].concat(call.request.inviteeUserIds)
        },
        userStatus: CommonImport.protos.enums.userStatuses.ACTIVE
      }).toArray();
    }, {}).then((usersCheckRes) => {
      if (usersCheckRes.length < call.request.inviteeUserIds.length + 1) {
        return CommonImport.Promise.reject(new CommonImport.errors.ResourceNotFound.ActiveUserNotFound());
      } else if (usersCheckRes.length > call.request.inviteeUserIds.length + 1) {
        return CommonImport.Promise.reject(new CommonImport.errors.DirtyDataDetected.DirtyUserDataDetected());
      } else {
        const groupsCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.groupsCollectionName);
        const epochNow = +new Date();
        const $setObj = call.request.inviteeUserIds.reduce((acc, curr) => {
          acc[`members.${curr}`] = {
            joinInAt: epochNow
          };
          return acc;
        }, {
          lastUpdate: epochNow
        });
        return CommonImport.utils.bluebirdRetryExecutor(() => {
          groupsCollection.updateOne({
            groupId: call.request.toGroupId,
            managers: call.request.inviterUserId
          }, {
            $set: $setObj
          });
        }, {});
      }
    }).then((res) => {
      console.log(res);
      callback(null, {success: true});
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = InviteUserToGroupImpl;


