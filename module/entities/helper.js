const entityTypesHelper = require(MODULES_BASE_PATH + "/entityTypes/helper");
const userRolesHelper = require(MODULES_BASE_PATH + "/user-roles/helper");
const elasticSearch = require(GENERIC_HELPERS_PATH + "/elastic-search");

module.exports = class EntitiesHelper {


     /**
   * List entity documents.
   * @method
   * @name entityDocuments
   * @param {Object} [findQuery = "all"] - filter query object if not provide 
   * it will load all the document.
   * @param {Array} [fields = "all"] - All the projected field. If not provided
   * returns all the field
   * @param {Number} [limitingValue = ""] - total data to limit.
   * @param {Number} [skippingValue = ""] - total data to skip.
   * @returns {Array} - returns an array of entities data.
   */

  static entityDocuments(
    findQuery = "all", 
    fields = "all",
    skipFields = "none", 
    limitingValue = "", 
    skippingValue = "",
    sortedData = ""
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                
                let queryObject = {};
                
                if (findQuery != "all") {
                    queryObject = findQuery;
                }
                
                let projectionObject = {};
                
                if (fields != "all") {
                    
                    fields.forEach(element => {
                        projectionObject[element] = 1;
                    });
                }

                if (skipFields != "none") {
                    skipFields.forEach(element => {
                        projectionObject[element] = 0;
                    });
                }
                
                let entitiesDocuments;
                
                if( sortedData !== "" ) {
                    
                    entitiesDocuments = await database.models.entities
                    .find(queryObject, projectionObject)
                    .sort(sortedData)
                    .limit(limitingValue)
                    .skip(skippingValue)
                    .lean();
                } else {
                    
                    entitiesDocuments = await database.models.entities
                    .find(queryObject, projectionObject)
                    .limit(limitingValue)
                    .skip(skippingValue)
                    .lean();
                }
                return resolve(entitiesDocuments);
            } catch (error) {
                return reject(error);
            }
        });
    }

     /**
   * Search entity.
   * @method 
   * @name search
   * @param {String} searchText - Text to be search.
   * @param {Number} pageSize - total page size.
   * @param {Number} pageNo - Page no.
   * @param {Array} [entityIds = false] - Array of entity ids.
   */

  static search( searchText, pageSize, pageNo, entityIds = false ) {
    return new Promise(async (resolve, reject) => {
        try {

            let queryObject = {};

            queryObject["$match"] = {};

            if (entityIds && entityIds.length > 0) {
                queryObject["$match"]["_id"] = {};
                queryObject["$match"]["_id"]["$in"] = entityIds;
            }

            if( searchText !== "") {
                queryObject["$match"]["$or"] = [
                    { "metaInformation.name": new RegExp(searchText, 'i') },
                    { "metaInformation.externalId": new RegExp("^" + searchText, 'm') },
                    { "metaInformation.addressLine1": new RegExp(searchText, 'i') },
                    { "metaInformation.addressLine2": new RegExp(searchText, 'i') }
                ];
            }

            let entityDocuments = await database.models.entities.aggregate([
                queryObject,
                {
                    $project: {
                        name: "$metaInformation.name",
                        externalId: "$metaInformation.externalId",
                        addressLine1: "$metaInformation.addressLine1",
                        addressLine2: "$metaInformation.addressLine2",
                        entityType : 1
                    }
                },
                {
                    $facet: {
                        "totalCount": [
                            { "$count": "count" }
                        ],
                        "data": [
                            { $skip: pageSize * (pageNo - 1) },
                            { $limit: pageSize }
                        ],
                    }
                }, {
                    $project: {
                        "data": 1,
                        "count": {
                            $arrayElemAt: ["$totalCount.count", 0]
                        }
                    }
                }
            ]);

            return resolve(entityDocuments);

        } catch (error) {
            return reject(error);
        }
    })
  }

    /**
     * List all entities based on type.
     * @method
     * @name listByEntityType 
     * @param {String} entityType - entity type
     * @param {Number} pageSize - total page size.
     * @param {Number} pageNo - page number.
     * @param {String} searchText - text to search.
     * @returns {Array} - List of all entities based on type.
     */

    static listByEntityType( entityType,pageSize,pageNo,searchText = "",version = constants.common.VERSION_1 ) {
        return new Promise(async (resolve, reject) => {
            try {


                let queryObject = {
                    $match : {
                        entityType : entityType
                    }
                };
    
                if( searchText !== "") {
                    queryObject["$match"]["$or"] = [
                        { "metaInformation.name": new RegExp(searchText, 'i') },
                        { "metaInformation.externalId": new RegExp("^" + searchText, 'm') },
                        { "metaInformation.addressLine1": new RegExp(searchText, 'i') },
                        { "metaInformation.addressLine2": new RegExp(searchText, 'i') }
                    ];
                }

                let aggregationData = [
                    queryObject,
                    {
                        $project: {
                            name: "$metaInformation.name",
                            externalId: "$metaInformation.externalId"
                        }
                    }
                ];

                if( version === constants.common.VERSION_2 ) {
                    
                    aggregationData.push({
                        $facet: {
                            "totalCount": [
                                { "$count": "count" }
                            ],
                            "data": [
                                { $skip: pageSize * (pageNo - 1) },
                                { $limit: pageSize }
                            ],
                        }
                    },{
                        $project: {
                            "data": 1,
                            "count": {
                                $arrayElemAt: ["$totalCount.count", 0]
                            }
                        }
                    });
                }
    
                let entityDocuments = 
                await database.models.entities.aggregate(aggregationData);
                
                return resolve({
                    message: constants.apiResponses.ENTITIES_FETCHED,
                    result: entityDocuments
                });

            } catch (error) {
                reject(error);
            }
        })

    }

    /**
    * Get immediate entities.
    * @method
    * @name listByEntityType
    * @param {Object} entityId
    * @returns {Array} - List of all immediateEntities based on entityId.
    */

    static immediateEntities(entityId, searchText = "",pageSize="",pageNo="") {
        return new Promise(async (resolve, reject) => {

            try {
                
                let projection = [
                    constants.schema.ENTITYTYPE,
                    constants.schema.GROUPS
                ];
    
                let entitiesDocument = await this.entityDocuments({
                    _id: entityId
                }, projection);
    
                let immediateEntities = [];
    
                if (entitiesDocument[0] &&
                    entitiesDocument[0].groups &&
                    Object.keys(entitiesDocument[0].groups).length > 0
                ) {
    
                    let getImmediateEntityTypes =
                        await entityTypesHelper.list({
                            name : entitiesDocument[0].entityType
                        },["immediateChildrenEntityType"]
                        );
    
                    let immediateEntitiesIds;
    
                    Object.keys(entitiesDocument[0].groups).forEach(entityGroup => {
                        if (
                            getImmediateEntityTypes[0].immediateChildrenEntityType &&
                            getImmediateEntityTypes[0].immediateChildrenEntityType.length > 0 &&
                            getImmediateEntityTypes[0].immediateChildrenEntityType.includes(entityGroup)
                        ) {
                            immediateEntitiesIds = 
                            entitiesDocument[0].groups[entityGroup];
                        }
                    })
    
                    if (
                        Array.isArray(immediateEntitiesIds) &&
                        immediateEntitiesIds.length > 0
                    ) {
                   
                        let searchImmediateData = await this.search(
                            searchText, 
                            pageSize, 
                            pageNo, 
                            immediateEntitiesIds
                        );
    
                        immediateEntities = searchImmediateData[0];
                    }
                }
    
                return resolve(immediateEntities);

            } catch(error) {
                return reject(error);
            }
        })
    }

    /**
     * Get immediate entities for requested Array.
     * @method
     * @name subList
     * @param {params} entities - array of entitity ids
     * @param {params} entityId - single entitiy id
     * @param {params} type - sub list entity type. 
     * @param {params} search - search entity data. 
     * @param {params} limit - page limit. 
     * @param {params} pageNo - page no. 
     * @returns {Array} - List of all sub list entities.
     */

    static subEntityList( entities,entityId,type,search,limit,pageNo ) {
        return new Promise(async (resolve, reject) => {

            try {

                let result = [];
                let obj = {
                    entityId : entityId,
                    type : type,
                    search : search,
                    limit : limit,
                    pageNo : pageNo
                }
    
                if ( entityId !== "" ) {
                    result = await this.subEntities(
                        obj
                    );
                } else {
    
                    await Promise.all(entities.map(async (entity)=> {
    
                        obj["entityId"] = entity;
                        let entitiesDocument = await this.subEntities(
                            obj
                        );

                        if( Array.isArray(entitiesDocument.data) && 
                        entitiesDocument.data.length > 0
                        ) {
                            result = entitiesDocument;
                        }
                    }));
                }

                if( result.data && result.data.length > 0 ) {
                    result.data = result.data.map(data=>{
                        let cloneData = {...data};
                        cloneData["label"] = cloneData.name;
                        cloneData["value"] = cloneData._id;
                        return cloneData;
                    })
                }
    
                resolve({
                    message: constants.apiResponses.ENTITIES_FETCHED,
                    result: result
                });   
            } catch(error) {
                return reject(error);
            }
        })
    }

     /**
     * Get either immediate entities or entity traversal based upon the type.
     * @method
     * @name subEntities
     * @param {body} entitiesData
     * @returns {Array} - List of all immediate entities or traversal data.
     */

    static subEntities( entitiesData ) {
        return new Promise(async (resolve, reject) => {

            try {
                
                let entitiesDocument;
                
                if( entitiesData.type !== "" ) {
                    
                    entitiesDocument = await this.entityTraversal(
                        entitiesData.entityId,
                        entitiesData.type,
                        entitiesData.search,
                        entitiesData.limit,
                        entitiesData.pageNo
                        );
                } else {
                    
                    entitiesDocument = await this.immediateEntities(
                        entitiesData.entityId, 
                        entitiesData.search,
                        entitiesData.limit,
                        entitiesData.pageNo
                    );
                }
                
                return resolve(entitiesDocument);
            } catch(error) {
                return reject(error);
            }
        })
    }

    /**
    * Get immediate entities.
    * @method
    * @name listByEntityType
    * @param {Object} entityId
    * @returns {Array} - List of all immediateEntities based on entityId.
    */

   static entityTraversal(
       entityId,
       entityTraversalType = "", 
       searchText = "",
       pageSize,
       pageNo
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                
                let entityTraversal = `groups.${entityTraversalType}`;

                let entitiesDocument = 
                await this.entityDocuments(
                    { 
                        _id: entityId,
                        "groups" : { $exists : true }, 
                        [entityTraversal] : { $exists: true } 
                    },
                    [ entityTraversal ]
                );

                if( !entitiesDocument[0] ) {
                    return resolve([]);
                }

                let result = [];
                
                if( entitiesDocument[0].groups[entityTraversalType].length > 0 ) {
                    
                    let entityTraversalData = await this.search(
                        searchText,
                        pageSize,
                        pageNo,
                        entitiesDocument[0].groups[entityTraversalType]
                    );

                    result = entityTraversalData[0];

                }

                return resolve(result);

            } catch(error) {
                return reject(error);
            }
        })
   }

   /**
   * All the related entities for the given entities.
   * @method
   * @name relatedEntities
   * @param {String} entityId - entity id.
   * @param {String} entityTypeId - entity type id.
   * @param {String} entityType - entity type.
   * @param {Array} [projection = "all"] - total fields to be projected.
   * @returns {Array} - returns an array of related entities data.
   */

  static relatedEntities(entityId, entityTypeId, entityType, projection = "all") {
    return new Promise(async (resolve, reject) => {
        try {

            let relatedEntitiesQuery = {};

            if (entityTypeId && entityId && entityType) {
                relatedEntitiesQuery[`groups.${entityType}`] = entityId;
                relatedEntitiesQuery["entityTypeId"] = {};
                relatedEntitiesQuery["entityTypeId"]["$ne"] = entityTypeId;
            } else {
                return resolve({ 
                    status: httpStatusCode.bad_request.status, 
                    message: constants.apiResponses.MISSING_ENTITYID_ENTITYTYPE_ENTITYTYPEID 
                });
            }

            let relatedEntitiesDocument = await this.entityDocuments(relatedEntitiesQuery, projection);
            
            relatedEntitiesDocument = relatedEntitiesDocument ? relatedEntitiesDocument : [];

            return resolve(relatedEntitiesDocument);


        } catch (error) {
            return reject({
                status: error.status || httpStatusCode.internal_server_error.status,
                message: error.message || httpStatusCode.internal_server_error.message
            });
        }
    })
  }

   /**
   * Entity details information.
   * @method 
   * @name details
   * @param {String} entityId - _id of entity.
   * @return {Object} - consists of entity details information. 
   */

  static details( entityId ) {
    return new Promise(async (resolve, reject) => {
        try {

            let entityDocument = await this.entityDocuments(
                {
                    _id : entityId
                },
                "all",
                ["groups"]
            );

            if ( !entityDocument[0] ) {
                return resolve({
                    status : httpStatusCode.bad_request.status,
                    message : constants.apiResponses.ENTITY_NOT_FOUND
                })
            }

            resolve({
                message : constants.apiResponses.ENTITY_INFORMATION_FETCHED,
                result : entityDocument[0]
            });

        } catch (error) {
            return reject(error);
        }
    })
  }

   /**
     * List roles by entity type.
     * @method
     * @name subEntitiesRoles
     * @param entityId - entity id.
     * @returns {Object} List of roles by entity id.
    */

   static subEntitiesRoles( entityId ) {
    return new Promise(async (resolve, reject) => {
        try {

             const entityDocuments = await this.entityDocuments({
                 _id : entityId
             },["childHierarchyPath"]);

             if( !entityDocuments.length > 0 ) {
                 return resolve({
                     message : constants.apiResponses.STATE_NOT_FOUND,
                     result : []
                 })
             }

             if( !entityDocuments[0].childHierarchyPath || !entityDocuments[0].childHierarchyPath.length > 0 ) {
                 return resolve({
                     message : constants.apiResponses.SUB_ENTITY_NOT_FOUND,
                     result : []
                 })
             }
            
            const rolesData = await userRolesHelper.roleDocuments({
                "entityTypes.entityType" : { $in : entityDocuments[0].childHierarchyPath }
            },["code","title"]);

            if( !rolesData.length > 0 ) {
             return resolve({
                 message : constants.apiResponses.USER_ROLES_NOT_FOUND,
                 result : []
             })
            }

            return resolve({
                message : constants.apiResponses.USER_ROLES_FETCHED,
                result : rolesData
             });

        } catch (error) {
            return reject(error);
        }
    })

}

    /**
   * Get users by entityId and role
   * @method
   * @name getUsersByEntityAndRole
   * @param {Object} requestedData - requested data.
   * @param {String} entityId - entity id.
   * @param {String} role - role code.
   * @returns {Array}  - List of userIds and entityIds
   */

  static getUsersByEntityAndRole( entityId= "", role= "" ) {
    return new Promise(async (resolve, reject) => {
        try {

            if (entityId == "") {
                throw new Error(constants.apiResponses.ENTITY_ID_REQUIRED);
            }

            if (role == "") {
                throw new Error(constants.apiResponses.ROLE_REQUIRED)
            }

            let userRole = await userRolesHelper.roleDocuments({
                code : role
            },[
                "entityTypes"
            ]);
            
            if(!userRole.length) {
                throw new Error(constants.apiResponses.INVALID_ROLE)
            }

            let entityType = userRole[0].entityTypes[0].entityType;
            
            let entityDocument = await this.entityDocuments
            (
                {
                    _id: entityId
                },
                [
                    `groups.${entityType}` 
                ]
            )
            
            if (!entityDocument.length) {
                throw new Error(constants.apiResponses.USERS_NOT_FOUND);
            }

            let queryObject = {
                query: {
                    terms: {
                        "_id": entityDocument[0].groups[entityType]
                    }
                },
                _source: [`data.roles.${role}`]
            }
          
            let entities = await elasticSearch.searchDocumentFromIndex
            (
                process.env.ELASTICSEARCH_ENTITIES_INDEX,
                "_doc",
                queryObject,
                null,
                null
            )

            if (!entities.length) {
                throw new Error(constants.apiResponses.USERS_NOT_FOUND)
            }
            
            let result = [];
            
            await Promise.all(entities.map (async entity => {
                if (Object.keys(entity.data.roles).length > 0) {
                    await Promise.all(entity.data.roles[role].map(userId => {
                        result.push({
                            entityId: entity.id,
                            userId: userId
                        })
                    }))
                }
            }))
           
            resolve({
                success: true,
                message : constants.apiResponses.USERS_AND_ENTITIES_FETCHED,
                data : result
            });

        } catch (error) {
            return resolve({
                success: false,
                message: error.message,
                data: false
            });
        }
    })
  }

}
