'use strict';

const CommonImport = require('../../util/CommonImport');

class LeaveGroupImpl {

  static leaveGroup(call, callback) {

    const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
    const groupsCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.groupsCollectionName);

    const epochNow = +new Date();

    // Self quitting.
    if (call.request.targetUserUserIds.length === 1 && call.request.targetUserUserIds[0] === call.request.initiatorUserId) {

      CommonImport.utils.bluebirdRetryExecutor(() => {
        return groupsCollection.findOneAndUpdate({
          groupId: call.request.fromGroupId,
          $or: [
            {
              $and: [
                {
                  managers: call.request.initiatorUserId
                }, {
                  $where: 'this.managers.length > 1'
                }
              ]
            }, {
              managers: {
                $nin: [call.request.initiatorUserId]
              }
            }
          ]
        }, {
          $pull: {
            managers: call.request.initiatorUserId
          },
          $set: {
            [`members.${call.request.initiatorUserId}.leaveAt`]: epochNow,
            lastUpdate: epochNow
          }
        }, {
          projection: {
            managers: 1
          }
        });
      }, {}).then((res) => {
        if (res.value) {
          callback(null, {success: true});
        } else {
          return CommonImport.Promise.reject(new CommonImport.errors.UncategorizedError.InvalidRequest());
        }
      }).catch((err) => {
        CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
      });

    } else {

      // Kick.

      CommonImport.utils.bluebirdRetryExecutor(() => {
        return groupsCollection.findOne({
          groupId: call.request.fromGroupId
        }, {
          fields: {
            managers: 1,
            members: 1
          }
        });
      }, {}).then((res) => {
        if (res.managers.indexOf(call.request.initiatorUserId) === -1) {
          return CommonImport.Promise.reject(new CommonImport.errors.NoPermission.NoPermissionKickUser());
        }

        const isReallyNecessaryToProceed = Object.keys(res.members).some((meberUserId) => {
          if (call.request.targetUserUserIds.indexOf(meberUserId) !== -1) {
            return true;
          }
          return false;
        });

        if (!isReallyNecessaryToProceed) {
          return CommonImport.Promise.reject(new CommonImport.errors.UncategorizedError.RedundantRequest());
        }

        let managerNumber = res.managers.length;
        call.request.targetUserUserIds.every((userId) => {
          if (managerNumber === 0) {
            return false;
          }
          if (res.managers.indexOf(userId) !== -1) {
            managerNumber--;
          }
          return true;
        });

        if (managerNumber === 0) {
          return CommonImport.Promise.reject(new CommonImport.errors.BusinessLogic.AtLeastOneManager());
        }

        const $setObj = call.request.targetUserUserIds.reduce((acc, curr) => {
          acc[`members.${curr}.leaveAt`] = epochNow;
          return acc;
        }, {
          lastUpdate: epochNow
        });

        return CommonImport.utils.bluebirdRetryExecutor(() => {
          return groupsCollection.updateOne({
            groupId: call.request.fromGroupId
          }, {
            $pullAll: {
              managers: call.request.targetUserUserIds
            },
            $set: $setObj
          });
        }, {});
        
      }).then((res) => {
        callback(null, {success: true});
      }).catch((err) => {
        CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
      });

    }

  }

}

module.exports = LeaveGroupImpl;


