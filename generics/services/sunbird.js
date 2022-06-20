/**
 * name : sunbird.js
 * author : Vishnudas
 * Date : 22-Feb-2022
 * Description : All Sunbird learner related api call.
 */

//dependencies


const request = require('request');
const sunbirdBaseUrl = process.env.SUNBIRD_SERVICE_URL;
const serverTimeout = process.env.SUNBIRD_SERVER_TIMEOUT ? parseInt(process.env.SUNBIRD_SERVER_TIMEOUT) : 500;
const dataLimit = process.env.SUNBIRD_RESPONSE_DATA_LIMIT ? parseInt(process.env.SUNBIRD_RESPONSE_DATA_LIMIT) : 10000;
/**
  * 
  * @function
  * @name learnerLocationSearch
  * @param {String} bearerToken - autherization token.
  * @param {object} filterData -  bodydata .
  * @returns {Promise} returns a promise.
*/

const learnerLocationSearch = function ( filterData, pageSize = "", pageNo = "", searchKey = "" ) {
  return new Promise(async (resolve, reject) => {
      try {
        
        let bodyData = {};
        bodyData["request"] = {};
        bodyData["request"]["filters"] = filterData;

        if ( pageSize !== "" ) {
            bodyData["request"]["limit"] = pageSize;
        } else {
            bodyData["request"]["limit"] = dataLimit;
        }

        if ( pageNo !== "" ) {
            let offsetValue = pageSize * ( pageNo - 1 ); 
            bodyData["request"]["offset"] = offsetValue;
        }

        if ( searchKey !== "" ) {
            bodyData["request"]["query"] = searchKey
        }
        
          
        const url = 
        sunbirdBaseUrl + constants.endpoints.GET_LOCATION_DATA;
        const options = {
            headers : {
                "Authorization" : process.env.SUNBIRD_SERVICE_AUTHERIZATION,
                "content-type": "application/json"
            },
            json : bodyData
        };

        request.post(url,options,sunbirdCallback);

        let result = {
            success : true
        };

        function sunbirdCallback(err, data) {

            
            if (err) {
                result.success = false;
            } else {
                  
                let response = data.body;
                if( response.responseCode === constants.common.OK) {
                    result["data"] = response.result;
                } else {
                      result.success = false;
                }
            }
            return resolve(result);
        }

        setTimeout(function () {
           return reject (result = {
               success : false
            });
        }, serverTimeout);


      } catch (error) {
          return reject(error);
      }
  })
}

/**
  * 
  * @function
  * @name formRead
  * @param {String} bearerToken - autherization token.
  * @param {object} bodyData -  subType data.
  * @returns {Promise} returns a promise.
*/
const formRead = function ( subTypeData ) {
    return new Promise(async (resolve, reject) => {
        try {
            
            let bodyData = {
                request : {
                    type: constants.common.FORM_API_TYPE,
                    subType: subTypeData,
                    action: constants.common.GET_METHOD
                }
            }
            
            const url = 
            sunbirdBaseUrl + constants.endpoints.GET_FORM_DATA;
            const options = {
                headers : {
                    "Authorization" : process.env.SUNBIRD_SERVICE_AUTHERIZATION,
                    "content-type": "application/json"
                },
                json : bodyData
            };
  
            request.post(url,options,sunbirdCallback);
            let result = {
                success : true
            };  
            function sunbirdCallback(err, data) {
  
               
                if (err) {
                    result.success = false;
                } else {
                    
                    let response = data.body;
                    
                    if( response.responseCode === constants.common.OK) {
                        result["data"] = response.result;
                        result.success = true;
                    } else {
                        result.success = false;
                    }
                }
                return resolve(result);
            }
            setTimeout(function () {
                return reject (result = {
                    success : false
                 });
             }, serverTimeout);

        } catch (error) {
            return reject(error);
        }
    })
}

/**
  * 
  * @function
  * @name schoolData
  * @param {String} bearerToken - autherization token.
  * @param {object} bodyData -  location id
  * @param {array} fields - set of data keys need to be fetched.
  * @param {String} searchKey - search key for fuzzy search.
  * @returns {Promise} returns a promise.
*/
const schoolData = function ( filterData, pageSize = "", pageNo = "", searchKey = "", fields) {
    return new Promise(async (resolve, reject) => {
        try {
            
            let bodyData = {};
            bodyData["request"] = {};
            bodyData["request"]["filters"] = filterData;

            if ( pageSize !== "" ) {
                bodyData["request"]["limit"] = pageSize;
            } 
    
            if ( pageNo !== "" ) {
                let offsetValue = pageSize * ( pageNo - 1 ); 
                bodyData["request"]["offset"] = offsetValue;
            }
    
            if ( searchKey !== "" ) {
                bodyData["request"]["fuzzy"] = {
                    "orgName" : searchKey
                }
            }
            
            //for getting specified key data only.
            if ( fields.length > 0 ) {
                bodyData["request"]["fields"] = fields;
            }

        
            
            const url = 
            sunbirdBaseUrl + constants.endpoints.GET_SCHOOL_DATA;
            const options = {
                headers : {
                    "Authorization" : process.env.SUNBIRD_SERVICE_AUTHERIZATION,
                    "content-type": "application/json"
                },
                json : bodyData
            };
  
            request.post(url,options,sunbirdCallback);
            let result = {
                success : true
            };
  
            function sunbirdCallback(err, data) {
  
                
  
                if (err) {
                    result.success = false;
                } else {
                    
                    let response = data.body;
                    
                    if( response.responseCode === constants.common.OK) {
                        result["data"] = response.result;
                    } else {
                        result.success = false;
                    }
                }
                return resolve(result);
            }
            setTimeout(function () {
                return reject (result = {
                    success : false
                 });
             }, serverTimeout);

        } catch (error) {
            return reject(error);
        }
    })
}

module.exports = {
  learnerLocationSearch : learnerLocationSearch,
  formRead : formRead,
  schoolData :schoolData
};