'use strict';

const CommonImport = require('../../util/CommonImport');

class _DeleteGroupImpl {

  static deleteGroup(call, callback) {

    CommonImport.utils.bluebirdRetryExecutor(() => {
      const dbPool = CommonImport.utils.pickRandomly(global.DB_POOLS);
      const groupsCollection = dbPool.collection(global.RELATED_MONGODB_COLLECTIONS.groupsCollectionName);
      return groupsCollection.deleteOne(call.request);
    }, {}).then((res) => {
      if (res.deletedCount === 1) {
        callback(null, {success: true});
      } else {
        return CommonImport.Promise.reject(new CommonImport.errors.UnknownError());
      }
    }).catch((err) => {
      CommonImport.utils.apiImplCommonErrorHandler(err, CommonImport.errors, callback);
    });

  }

}

module.exports = _DeleteGroupImpl;


