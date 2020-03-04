/**
 * name : bodh/helper.js
 * author : Akash Shah
 * created-date : 03-Jan-2020
 * Description : All Bodh related helper functions.
 */

// Dependencies
const fs = require("fs");
const { promisify } = require("util");
const httpRequest = require(GENERIC_HELPERS_PATH+'/http-request');
const dictionaryHelper = require(MODULES_BASE_PATH + "/dictionary/helper");
const elasticSearchHelper = require(GENERIC_HELPERS_PATH + "/elastic-search");

// Constants
const bodhContentIndex = gen.utils.checkIfEnvDataExistsOrNot("ELASTICSEARCH_BODH_CONTENT_INDEX");
const bodhContentIndexType = gen.utils.checkIfEnvDataExistsOrNot("ELASTICSEARCH_BODH_CONTENT_INDEX_TYPE");
const qrCodeHelpers = require(MODULES_BASE_PATH+"/qr-codes/helper");
let sunbirdService = require(ROOT_PATH+"/generics/services/sunbird");

/**
    * BodhHelper
    * @class
*/

module.exports = class BodhHelper {

     /**
      * Forward search request and retrieve search results.
      * @method
      * @name getSearchResults
      * @param {Object} request Contains request url, headers and body.
      * @returns {Promise} returns a promise.
     */

    static getSearchResults(request) {
        return new Promise(async (resolve, reject) => {
            try {

                
                let reqObj = new httpRequest()

                let response = await reqObj.post(
                    request.url,
                    {
                        json : request.body,
                        headers : request.headers
                    }
                )

                return resolve({
                    success : true,
                    message : "Search results from bodh service.",
                    data : response
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }


     /**
      * Parse content for keywords and insert in Elastic search.
      * @method
      * @name parseContentForKeywords
      * @param {Array} content Contains array of content.
      * @returns {Promise} returns a promise.
     */

    static parseContentForKeywords(content = []) {
        return new Promise(async (resolve, reject) => {
            try {

                if(content.length < 0) {
                    throw new Error("Missing content details.");
                }

                let keywordsData = new Array

                content.forEach(eachContent => {
                    keywordsData.push(...eachContent.keywords)
                })

                let keywordsUpdateResult = new Array

                for (let pointerToKeywordsData = 0;
                    pointerToKeywordsData < keywordsData.length;
                    pointerToKeywordsData++) {
                        
                        let addKeywordOperation = await dictionaryHelper
                        .addWordToDictionary(keywordsData[pointerToKeywordsData]);

                        if(!addKeywordOperation.data) {
                            keywordsUpdateResult.push({
                                word : keywordsData[pointerToKeywordsData],
                                status : constants.common.FAILED
                            })
                        } else {
                            keywordsUpdateResult.push({
                                word : keywordsData[pointerToKeywordsData],
                                status : "Success."
                            })
                        }
                        
                }

                return resolve({
                    success : true,
                    message : "Updated Keywords in Elastic Search.",
                    data : keywordsUpdateResult
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }


     /**
      * Parse content insert in Elastic search to use for auto completion.
      * @method
      * @name parseContentForAutocomplete
      * @param {Array} content Contains array of content.
      * @param {Boolean} isACourse Whether or not content is a course.
      * @returns {Promise} returns a promise.
     */

    static parseContentForAutocomplete(content = [], isACourse = false) {
        return new Promise(async (resolve, reject) => {
            try {

                if(content.length < 0) {
                    throw new Error("Missing content details.");
                }

                let contentUpdateResult = new Array

                for (let pointerToContentData = 0;
                    pointerToContentData < content.length;
                    pointerToContentData++) {
                        
                        const eachContent = content[pointerToContentData];

                        let suggestContent = {
                            input : [
                                eachContent.name.trim().toLowerCase(),
                                eachContent.description.trim().toLowerCase()
                            ],
                            contexts : {
                                isACourse : isACourse
                            }
                        }

                        const addCourseToAutocomplete = await elasticSearchHelper.createOrUpdateDocumentInIndex(
                            bodhContentIndex,
                            bodhContentIndexType,
                            eachContent.IL_UNIQUE_ID,
                            {
                                suggest : suggestContent,
                                rawContent : eachContent
                            }
                        );

                        if(addCourseToAutocomplete.statusCode != httpStatusCode["ok"].status && addCourseToAutocomplete.statusCode != 201) {
                            throw new Error("Failed to add content to auto complete.")
                        }

                        if(!addCourseToAutocomplete.data) {
                            contentUpdateResult.push({
                                IL_UNIQUE_ID : eachContent.IL_UNIQUE_ID,
                                status : constants.common.FAILED
                            })
                        } else {
                            contentUpdateResult.push({
                                IL_UNIQUE_ID : eachContent.IL_UNIQUE_ID,
                                status : constants.common.SUCCESS
                            })
                        }
                        
                }

                return resolve({
                    success : true,
                    message : "Updated Keywords in Elastic Search.",
                    data : contentUpdateResult
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }

     /**
      * Log query which missed ES spell check and returned no results from Bodh Service.
      * @method
      * @name logQueryMissFromESAndBodh
      * @param {String} queryString Query typed by user.
      * @param {String} searchServiceUrl Bodh search service URL requested.
      * @returns {Promise} returns a promise.
     */

    static logQueryMissFromESAndBodh(queryString = "", searchServiceUrl = "") {
        return new Promise(async (resolve, reject) => {
            try {

                if(queryString == "" || searchServiceUrl == "") {
                    throw new Error("Missing query string or search service url.");
                }

                let today = new Date();

                let fileName = `${today.getDate()}-${today.getMonth()+1}-${today.getFullYear()}.csv`;
                
                let filePath = ROOT_PATH+"/"+process.env.LOGGER_DIRECTORY+"/bodh/search";
                
                fs.existsSync(filePath) || fs.mkdirSync(filePath, {recursive : true});

                const appendToFile = promisify(fs.appendFile);

                let data = `\n"${queryString}","${searchServiceUrl}"`;
                
                let writeToFilesResponse = await appendToFile(filePath+"/"+fileName, data, 'utf8')

                return resolve({
                    success : true,
                    message : "Updated Keywords in Elastic Search.",
                    data : true
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }


     /**
      * Check if mapping for dictionary index exists in Elastic search.
      * @method
      * @name autocompleteIndexTypeMapExists
      * @returns {Promise} returns a promise.
     */

    static autocompleteIndexTypeMapExists() {
        return new Promise(async (resolve, reject) => {
            try {

                if(bodhContentIndex == "") {
                    throw new Error("Missing bodh content index name");
                }

                if(bodhContentIndexType == "") {
                    throw new Error("Missing bodh content index type name");
                }

                const bodhIndexMapping = await elasticSearchHelper.getIndexTypeMapping(bodhContentIndex, bodhContentIndexType);

                if(bodhIndexMapping.statusCode != httpStatusCode["ok"].status) {
                    throw new Error("Bodh content index type map does not exist.");
                }
            
                return resolve({
                    success : true,
                    message : "Bodh content index type map exists",
                    data : true
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }


     /**
      * Get search suggestions for user query string from Elastic search.
      * @method
      * @name getSearchSuggestions
      * @param {String} queryString Query string for auto complete.
      * @param {Object} queryFilters Set of filters for search suggestions.
      * @param {Int} size Limit for search results.
      * @returns {Promise} returns a promise.
     */

    static getSearchSuggestions(queryString = "", queryFilters = {}, size = 10) {
        return new Promise(async (resolve, reject) => {
            try {

                if(queryString == "") throw new Error("Missing query string.");

                let searchContext = {
                    isACourse : (queryFilters["isACourse"]) ? queryFilters["isACourse"] : false
                }

                let queryObject = {
                    _source: "rawContent",
                    suggest: {
                        nameSuggestion: {
                            prefix: queryString.trim().toLowerCase(),
                            completion: {
                                field: "suggest",
                                size: size,
                                skip_duplicates : true,
                                fuzzy: true,
                                contexts : searchContext
                            }
                        }
                    }
                }

                const searchResponse = await elasticSearchHelper.searchDocumentFromIndex(bodhContentIndex, bodhContentIndexType, queryObject);

                let suggestions = new Array;

                if(searchResponse.nameSuggestion[0].options.length > 0) {

                    let allowedFilterConditons =  await this.getAutocompleteContextKeys();

                    if(allowedFilterConditons.success && allowedFilterConditons.data) {
                        allowedFilterConditons = allowedFilterConditons.data;
                    } else {
                        allowedFilterConditons = [];
                    }

                    let filters = {};
                    let filterKeys = new Array;

                    allowedFilterConditons.forEach(filterKey => {
                        if(queryFilters[filterKey]) {
                            if (typeof queryFilters[filterKey] === 'string') {
                                filterKeys.push(filterKey);
                                filters[filterKey] = queryFilters[filterKey];
                            } else if (Array.isArray(queryFilters[filterKey]) && queryFilters[filterKey].length > 0) {
                                filterKeys.push(filterKey);
                                filters[filterKey] = queryFilters[filterKey];
                            }
                        }
                    })

                    let searchResults = _.map(searchResponse.nameSuggestion[0].options, '_source.rawContent');

                    // searchResults = _.filter(searchResults, filters);

                    searchResults.forEach(content => {
                        let filterTestPass = true;
                        for (let index = 0; index < filterKeys.length; index++) {
                            const filterKey = filterKeys[index];

                            // If content filter value is a string
                            if(typeof filters[filterKey] === 'string') {

                                // If content value for filter key is an array
                                if(Array.isArray(content[filterKey])) {
                                    if (!content[filterKey].includes(filters[filterKey])) {
                                        filterTestPass = false;
                                        break;
                                    }
                                } else { // If content value for filter key is a string
                                    if(content[filterKey] != filters[filterKey]) {
                                        filterTestPass = false;
                                        break;
                                    }
                                }

                            } else if(Array.isArray(filters[filterKey])) { // If content filter value is an array
                                
                                let allFilterValues = filters[filterKey];
                                let atLeastOneFilterValueMatch = false;

                                // Loop all values for filter key
                                for (let pointerToFilterValues = 0; pointerToFilterValues < allFilterValues.length; pointerToFilterValues++) {
                                    const filterValue = allFilterValues[pointerToFilterValues];
                                    
                                    // If content value for filter key is an array
                                    if(typeof content[filterKey] === 'string') {
                                        if(content[filterKey] == filterValue) {
                                            atLeastOneFilterValueMatch = true;
                                            break;
                                        }
                                    } else if(Array.isArray(content[filterKey])) { // If content value for filter key is a string
                                        if (content[filterKey].includes(filters[filterKey])) {
                                            atLeastOneFilterValueMatch = true;
                                            break;
                                        }
                                    }
                                }

                                if(!atLeastOneFilterValueMatch) {
                                    filterTestPass = false;
                                    break;
                                }
                            }
                        }

                        if(filterTestPass) {
                            suggestions.push(content.name);
                        }
                    })
                }

                return resolve({
                    success : true,
                    message : "Search suggestions fetched successfully.",
                    data : suggestions
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }

     /**
      * Get context keys for auto complete index.
      * @method
      * @name getAutocompleteContextKeys
      * @returns {Promise} returns a promise.
     */

    static getAutocompleteContextKeys() {
        return new Promise(async (resolve, reject) => {
            try {

                return resolve({
                    success : true,
                    message : "Autocomplete field context keys.",
                    data : [
                        "channel",
                        "contentType",
                        "medium",
                        "gradeLevel",
                        "subject",
                        "board"
                    ]
                });
                
            } catch (error) {
                return resolve({
                    success : true,
                    message : error.message,
                    data : false
                });
            }
        })
    }

    /**
      * Generate qr code from the content data
      * @method
      * @name generateQrCode
      * @param contentData - Bodh content information
      * @param userId - Logged in user id.
      * @param userToken - Logged in user token.
      * @returns {Arary} returns a array of qr code links.
     */

    static generateQrCode( contentData,userId,userToken ) {
        return new Promise(async (resolve, reject) => {
            try {

                let codes = await qrCodeHelpers.generateCodes(
                    contentData.length,
                    userToken
                );

                await new Promise((resolve)=>setTimeout(() => {
                    resolve();
                }, 3000)); 

                let result = [];

                for( let code = 0 ; code < codes.length ; code ++ ) {
                    
                    await qrCodeHelpers.publishCode(
                        codes[code],
                        userToken
                    );

                    await this.linkContent(
                        codes[code],
                        contentData[code].identifier,
                        userToken
                    );
                    
                    let generateQrCode = await qrCodeHelpers.generate(
                        {
                            code : codes[code],
                            head : contentData[code].name,
                            tail : contentData[code].identifier,
                            metaInformation : { ... contentData[code] },
                            appName : "bodh"
                        },userId);
                        
                    await this.publishContent(
                        contentData[code].identifier,
                        contentData[code].lastPublishedBy
                    );
                        
                    result.push(generateQrCode);
                }
                return resolve({
                    message : constants.apiResponses.QR_CODE_GENERATED,
                    result : result
                });
                
            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * Link content based on dial code and content id
      * @method
      * @name linkContent
      * @param dialCode - dial code
      * @param identifier - content id
      * @param token - Logged in user token
      * @returns {Promise}
     */

    static linkContent( dialCode,identifier,token ) {
        return new Promise(async (resolve, reject) => {
            try {

                let linkContentData = await sunbirdService.linkContent(
                    token,
                    {
                        "request" : {
                            "content" : {
                                "dialcode" : [ dialCode ],
                                "identifier" : [ identifier ]
                            }
                        }
                    }
                );

                if( linkContentData.responseCode !== constants.common.OK ){
                    throw {
                        message : 
                        constants.apiResponses.COULD_NOT_LINK_BODH_CONTENT
                    }
                }

                return resolve(linkContentData.responseCode);
                
            } catch (error) {
                return reject(error);
            }
        })
    }

    /**
      * Publish content based oncontent id
      * @method
      * @name publishContent
      * @param contentId - content id
      * @param lastPublishedBy
      * @returns {Promise}
     */

    static publishContent( contentId, lastPublishedBy ) {
        return new Promise(async (resolve, reject) => {
            try {

                let publishContentData = await sunbirdService.publishContent(
                    {
                        "request" : {
                            "content" : {
                                "lastPublishedBy" : lastPublishedBy
                            }
                        }
                    },
                    contentId
                );

                if( publishContentData.responseCode !== constants.common.OK ){
                    throw {
                        message : 
                        constants.apiResponses.COULD_NOT_PUBLISH_CONTENT_DATA
                    }
                }

                return resolve(publishContentData.responseCode);
                
            } catch (error) {
                return reject(error);
            }
        })
    }

};