/**
 * name : users/helper.js
 * author : Aman Jung Karki
 * created-date : 03-Dc-2019
 * Description : All User related information including sys_admin.
 */

// Dependencies
const programsHelper = require(MODULES_BASE_PATH + "/programs/helper");
const solutionsHelper = require(MODULES_BASE_PATH + "/solutions/helper");
const userRolesHelper = require(MODULES_BASE_PATH + "/user-roles/helper");
const improvementProjectService = require(ROOT_PATH +
  "/generics/services/improvement-project");
const userService = require(ROOT_PATH + "/generics/services/users");
const formService = require(ROOT_PATH + "/generics/services/form");
const programUsersHelper = require(MODULES_BASE_PATH + "/programUsers/helper");
const surveyService = require(ROOT_PATH + "/generics/services/survey");

/**
 * UsersHelper
 * @class
 */

module.exports = class UsersHelper {
  /**
   * List of all private programs created by user
   * @method
   * @name privatePrograms
   * @param {string} userId - logged in user Id.
   * @returns {Array} - List of all private programs created by user.
   */

  static privatePrograms(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        let userPrivatePrograms = await programsHelper.userPrivatePrograms(
          userId
        );

        return resolve({
          message: constants.apiResponses.PRIVATE_PROGRAMS_LIST,
          result: userPrivatePrograms,
        });
      } catch (error) {
        return reject(error);
      }
    });
  }

  /**
   * Create user program and solution
   * @method
   * @name createProgramAndSolution
   * @param {string} userId - logged in user Id.
   * @param {object} programData - data needed for creation of program.
   * @param {object} solutionData - data needed for creation of solution.
   * @returns {Array} - Created user program and solution.
   */

  static createProgramAndSolution(
    userId,
    data,
    userToken,
    createADuplicateSolution = ""
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        let userPrivateProgram = {};
        let dateFormat = gen.utils.epochTime();
        let parentSolutionInformation = {};

        createADuplicateSolution = gen.utils.convertStringToBoolean(
          createADuplicateSolution
        );
        //program part
        if (data.programId && data.programId !== "") {
          let filterQuery = {
            _id: data.programId,
          };

          if (createADuplicateSolution === false) {
            filterQuery.createdBy = userId;
          }

          let checkforProgramExist = await programsHelper.programDocuments(
            filterQuery,
            "all",
            ["__v"]
          );

          if (!checkforProgramExist.length > 0) {
            return resolve({
              status: httpStatusCode["bad_request"].status,
              message: constants.apiResponses.PROGRAM_NOT_FOUND,
              result: {},
            });
          }

          if (createADuplicateSolution === true) {
            let duplicateProgram = checkforProgramExist[0];
            duplicateProgram = await _createProgramData(
              duplicateProgram.name,
              duplicateProgram.externalId
                ? duplicateProgram.externalId + "-" + dateFormat
                : duplicateProgram.name + "-" + dateFormat,
              true,
              constants.common.ACTIVE,
              duplicateProgram.description,
              userId,
              duplicateProgram.startDate,
              duplicateProgram.endDate,
              userId
            );

            userPrivateProgram = await programsHelper.create(
              _.omit(duplicateProgram, ["_id", "components", "scope"])
            );
          } else {
            userPrivateProgram = checkforProgramExist[0];
          }
        } else {
          /* If the programId is not passed from the front end, we will enter this else block. 
          In this block, we need to provide the necessary basic details to create a new program, Including startDate and endDate.*/
          // Current date
          let startDate = new Date();
          // Add one year to the current date
          let endDate = new Date();
          endDate.setFullYear(endDate.getFullYear() + 1);
          let programData = await _createProgramData(
            data.programName,
            data.programExternalId
              ? data.programExternalId
              : data.programName + "-" + dateFormat,
            true,
            constants.common.ACTIVE,
            data.programDescription
              ? data.programDescription
              : data.programName,
            userId,
            startDate,
            endDate
          );

          userPrivateProgram = await programsHelper.create(programData);
        }

        let solutionDataToBeUpdated = {
          programId: userPrivateProgram._id,
          programExternalId: userPrivateProgram.externalId,
          programName: userPrivateProgram.name,
          programDescription: userPrivateProgram.description,
          isAPrivateProgram: userPrivateProgram.isAPrivateProgram,
        };

        //entities
        if (
          Array.isArray(data.entities) &&
          data.entities &&
          data.entities.length > 0
        ) {
          let entitiesData = [];
          let bodyData = {};

          let locationData = gen.utils.filterLocationIdandCode(data.entities);

          if (locationData.ids.length > 0) {
            bodyData = {
              id: locationData.ids,
            };
            let entityData = await userService.locationSearch(bodyData);

            if (!entityData.success) {
              return resolve({
                status: httpStatusCode["bad_request"].status,
                message: constants.apiResponses.ENTITY_NOT_FOUND,
                result: {},
              });
            }

            entityData.data.forEach((entity) => {
              entitiesData.push(entity.id);
            });

            solutionDataToBeUpdated["entityType"] = entityData.data[0].type;
          }

          if (locationData.codes.length > 0) {
            let filterData = {
              code: locationData.codes,
            };
            let entityDetails = await userService.locationSearch(filterData);
            let entityDocuments = entityDetails.data;
            if (!entityDetails.success || !entityDocuments.length > 0) {
              return resolve({
                status: httpStatusCode["bad_request"].status,
                message: constants.apiResponses.ENTITY_NOT_FOUND,
                result: {},
              });
            }

            entityDocuments.forEach((entity) => {
              entitiesData.push(entity.id);
            });

            solutionDataToBeUpdated["entityType"] = constants.common.SCHOOL;
          }

          if (data.type && data.type !== constants.common.IMPROVEMENT_PROJECT) {
            solutionDataToBeUpdated["entities"] = entitiesData;
          }
        }

        //solution part
        let solution = "";
        if (data.solutionId && data.solutionId !== "") {
          let solutionData = await solutionsHelper.solutionDocuments(
            {
              _id: data.solutionId,
            },
            [
              "name",
              "link",
              "type",
              "subType",
              "externalId",
              "description",
              "certificateTemplateId",
            ]
          );

          if (!solutionData.length > 0) {
            return resolve({
              status: httpStatusCode["bad_request"].status,
              message: constants.apiResponses.SOLUTION_NOT_FOUND,
              result: {},
            });
          }

          if (createADuplicateSolution === true) {
            let duplicateSolution = solutionData[0];
            let solutionCreationData = await _createSolutionData(
              duplicateSolution.name,
              duplicateSolution.externalId
                ? duplicateSolution.externalId + "-" + dateFormat
                : duplicateSolution.name + "-" + dateFormat,
              true,
              constants.common.ACTIVE,
              duplicateSolution.description,
              userId,
              false,
              duplicateSolution._id
            );

            _.merge(duplicateSolution, solutionCreationData);
            _.merge(duplicateSolution, solutionDataToBeUpdated);

            solution = await solutionsHelper.create(
              _.omit(duplicateSolution, ["_id", "link"])
            );

            parentSolutionInformation.solutionId = duplicateSolution._id;
            parentSolutionInformation.link = duplicateSolution.link;
          } else {
            if (solutionData[0].isReusable === false) {
              return resolve({
                status: httpStatusCode["bad_request"].status,
                message: constants.apiResponses.SOLUTION_NOT_FOUND,
                result: {},
              });
            }

            solution = await database.models.solutions.findOneAndUpdate(
              {
                _id: solutionData[0]._id,
              },
              {
                $set: solutionDataToBeUpdated,
              },
              {
                new: true,
              }
            );
          }
        } else {
          let externalId, description;
          if (data.solutionName) {
            externalId = data.solutionExternalId
              ? data.solutionExternalId
              : data.solutionName + "-" + dateFormat;
            description = data.solutionDescription
              ? data.solutionDescription
              : data.solutionName;
          } else {
            externalId = userId + "-" + dateFormat;
            description = userPrivateProgram.programDescription;
          }

          let createSolutionData = await _createSolutionData(
            data.solutionName
              ? data.solutionName
              : userPrivateProgram.programName,
            externalId,
            userPrivateProgram.isAPrivateProgram,
            constants.common.ACTIVE,
            description,
            "",
            false,
            "",
            data.type ? data.type : constants.common.ASSESSMENT,
            data.subType ? data.subType : constants.common.INSTITUTIONAL,
            userId
          );

          _.merge(solutionDataToBeUpdated, createSolutionData);

          solution = await solutionsHelper.create(solutionDataToBeUpdated);
        }

        if (solution && solution._id) {
          await database.models.programs.findOneAndUpdate(
            {
              _id: userPrivateProgram._id,
            },
            {
              $addToSet: { components: ObjectId(solution._id) },
            }
          );
        }

        return resolve({
          message: constants.apiResponses.USER_PROGRAM_AND_SOLUTION_CREATED,
          result: {
            program: userPrivateProgram,
            solution: solution,
            parentSolutionInformation: parentSolutionInformation,
          },
        });
      } catch (error) {
        return reject(error);
      }
    });
  }

  /**
   * Entities mapping form data.
   * @method
   * @name entitiesMappingForm
   * @param {String} stateCode - state code.
   * @param {String} roleId - role id.
   * @returns {Object} returns a list of entitiesMappingForm.
   */

  static entitiesMappingForm(stateCode, roleId, entityKey) {
    return new Promise(async (resolve, reject) => {
      try {
        const rolesData = await userRolesHelper.roleDocuments(
          {
            _id: roleId,
          },
          ["entityTypes.entityType"]
        );

        if (!rolesData.length > 0) {
          return resolve({
            message: constants.apiResponses.USER_ROLES_NOT_FOUND,
            result: [],
          });
        }

        let subEntities = [];
        let cacheData = await cache.getValue(entityKey);

        if (!cacheData) {
          subEntities = await formService.configForStateLocation(
            stateCode,
            entityKey
          );
          if (!subEntities.length > 0) {
            return resolve({
              message: constants.apiResponses.ENTITY_NOT_FOUND,
              result: [],
            });
          }
        } else {
          subEntities = cacheData;
        }
        let roleEntityType = "";

        rolesData[0].entityTypes.forEach((roleData) => {
          if (subEntities.includes(roleData.entityType)) {
            roleEntityType = roleData.entityType;
          }
        });

        let entityTypeIndex = subEntities.findIndex(
          (path) => path === roleEntityType
        );

        let form = {
          field: "",
          label: "",
          value: "",
          visible: true,
          editable: true,
          input: "text",
          validation: {
            required: false,
          },
        };

        let forms = [];

        for (
          let pointerToChildHierarchy = 1;
          pointerToChildHierarchy < entityTypeIndex + 1;
          pointerToChildHierarchy++
        ) {
          let cloneForm = JSON.parse(JSON.stringify(form));
          let entityType = subEntities[pointerToChildHierarchy];
          cloneForm["field"] = entityType;
          cloneForm["label"] = `Select ${gen.utils.camelCaseToTitleCase(
            entityType
          )}`;

          if (roleEntityType === entityType) {
            cloneForm.validation.required = true;
          }

          forms.push(cloneForm);
        }

        return resolve({
          message: constants.apiResponses.ENTITIES_MAPPING_FORM_FETCHED,
          result: forms,
        });
      } catch (error) {
        return reject(error);
      }
    });
  }

  /**
   * User targeted solutions.
   * @method
   * @name solutions
   * @param {String} programId - program id.
   * @param {Object} requestedData requested data.
   * @param {String} pageSize page size.
   * @param {String} pageNo page no.
   * @param {String} search search text.
   * @param {String} token user token.
   * @param {String} userId user userId.
   * @returns {Object} targeted user solutions.
   */

  static solutions(
    programId,
    requestedData,
    pageSize,
    pageNo,
    search,
    token,
    userId,
    type
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        let programData = await programsHelper.programDocuments(
          {
            _id: programId,
          },
          [
            "name",
            "requestForPIIConsent",
            "rootOrganisations",
            "endDate",
            "description",
          ]
        );

        if (!programData.length > 0) {
          return resolve({
            status: httpStatusCode["bad_request"].status,
            message: constants.apiResponses.PROGRAM_NOT_FOUND,
          });
        }

        let totalCount = 0;
        let mergedData = [];
        /**
         * This @forUserRoleAndLocation check that particular program in belongs to user or not it belongs to user then it will return same program ID
         * @param requestedData {
         *  "district": "2f76dcf5-e43b-4f71-a3f2-c8f19e1fce03",
            "block": "966c3be4-c125-467d-aaff-1eb1cd525923",
            "state": "bc75cc99-9205-463e-a722-5326857838f8",
            "school": "28226200404",
            "role": "HM"
         * }
            @param programId :- programId passed in request
            @returns : {
            "success":true,
            "message":"Targeted programs fetched successfully",
            "data":[
                {
                  "_id":"63a42786c0b15a0009f0505e"
                }
            ],
            "count":1
          }
         */
        let targetedPrograms = await programsHelper.forUserRoleAndLocation(
          requestedData,
          "", // not passing page size
          "", // not passing page number
          "", // not passing search text
          ["_id"],
          programId // program Id we have to that will be validated
        );

        // check current program is targeted or not
        if (targetedPrograms.data.length === 0) {
          const solutionIds = [];
          const getAllResources = [];

          /**
           * @function importedProjects
           * @function userSurveys
           * @function userObservations
           *
           * @param token string: userToken
           * @param programId string: programId
           *
           * @returns {Promise}
           */
          // Creates an array of promises based on users Input
          switch (type) {
            case constants.common.IMPROVEMENT_PROJECT:
              getAllResources.push(
                improvementProjectService.importedProjects(token, programId)
              );
              break;
            case constants.common.SURVEY:
              getAllResources.push(surveyService.userSurveys(token, programId));
              break;
            case constants.common.OBSERVATION:
              getAllResources.push(
                surveyService.userObservations(token, programId)
              );
              break;
            default:
              getAllResources.push(
                improvementProjectService.importedProjects(token, programId)
              );
              getAllResources.push(surveyService.userSurveys(token, programId));
              getAllResources.push(
                surveyService.userObservations(token, programId)
              );
          }
          //here will wait till all promises are resolved
          const allResources = await Promise.all(getAllResources);

          //Will find all solutionId from response
          allResources.forEach((resources) => {
            // this condition is required because it returns response in different object structure
            if (
              resources.type === constants.common.IMPROVEMENT_PROJECT &&
              resources.success === true
            ) {
              resources.data.forEach((importedProject) => {
                solutionIds.push(importedProject.solutionInformation._id);
              });
            } else if (resources.success === true) {
              resources.result.forEach((resource) => {
                solutionIds.push(resource.solutionId);
              });
            }
          });

          /**
           * @function solutionDocuments
           * @param {Object} of solutionIds
           * @project [Array] of projections
           *
           * @return [{Objects}] array of solutions documents
           */
          mergedData = await solutionsHelper.solutionDocuments(
            { _id: { $in: solutionIds } },
            [
              "name",
              "description",
              "programName",
              "programId",
              "externalId",
              "projectTemplateId",
              "type",
              "language",
              "creator",
              "endDate",
              "link",
              "referenceFrom",
              "entityType",
              "certificateTemplateId",
            ]
          );
          totalCount = mergedData.length;
        } else {
          let autoTargetedSolutions =
            await solutionsHelper.forUserRoleAndLocation(
              requestedData,
              type,
              "",
              programId,
              constants.common.DEFAULT_PAGE_SIZE,
              constants.common.DEFAULT_PAGE_NO,
              search
            );

          let projectSolutionIdIndexMap = {};

          if (
            autoTargetedSolutions.data.data &&
            autoTargetedSolutions.data.data.length > 0
          ) {
            // Remove observation solutions which for project tasks.

            _.remove(autoTargetedSolutions.data.data, function (solution) {
              return (
                solution.referenceFrom == constants.common.PROJECT &&
                solution.type == constants.common.OBSERVATION
              );
            });

            totalCount = autoTargetedSolutions.data.data.length;
            mergedData = autoTargetedSolutions.data.data;

            mergedData = mergedData.map((targetedData, index) => {
              if (targetedData.type == constants.common.IMPROVEMENT_PROJECT) {
                projectSolutionIdIndexMap[targetedData._id.toString()] = index;
              }
              delete targetedData.programId;
              delete targetedData.programName;
              return targetedData;
            });
          }

          // Get projects already started by a user in a given program

          let importedProjects =
            await improvementProjectService.importedProjects(token, programId);

          // Add projectId to the solution object if the user has already started a project for the improvement project solution.

          if (importedProjects.success) {
            if (importedProjects.data && importedProjects.data.length > 0) {
              importedProjects.data.forEach((importedProject) => {
                if (
                  projectSolutionIdIndexMap[
                    importedProject.solutionInformation._id
                  ] !== undefined
                ) {
                  mergedData[
                    projectSolutionIdIndexMap[
                      importedProject.solutionInformation._id
                    ]
                  ].projectId = importedProject._id;
                } else {
                  let data = importedProject.solutionInformation;
                  data["projectTemplateId"] = importedProject.projectTemplateId;
                  data["projectId"] = importedProject._id;
                  data["type"] = constants.common.IMPROVEMENT_PROJECT;
                  mergedData.push(data);
                  totalCount = totalCount + 1;
                }
              });
            }
          }

          if (mergedData.length > 0) {
            let startIndex = pageSize * (pageNo - 1);
            let endIndex = startIndex + pageSize;
            mergedData = mergedData.slice(startIndex, endIndex);
          }

          // get all solutionIds of type survey
          let surveySolutionIds = [];
          mergedData.forEach((element) => {
            if (element.type === constants.common.SURVEY) {
              surveySolutionIds.push(element._id);
            }
          });

          if (surveySolutionIds.length > 0) {
            let userSurveySubmission = await surveyService.assignedSurveys(
              token,
              "",
              "",
              false,
              surveySolutionIds
            );

            if (
              userSurveySubmission.success &&
              userSurveySubmission.data &&
              userSurveySubmission.data.data &&
              userSurveySubmission.data.data.length > 0
            ) {
              for (
                let surveySubmissionPointer = 0;
                surveySubmissionPointer < userSurveySubmission.data.data.length;
                surveySubmissionPointer++
              ) {
                for (
                  let mergedDataPointer = 0;
                  mergedDataPointer < mergedData.length;
                  mergedDataPointer++
                ) {
                  if (
                    mergedData[mergedDataPointer].type ==
                      constants.common.SURVEY &&
                    userSurveySubmission.data.data[surveySubmissionPointer]
                      .solutionId == mergedData[mergedDataPointer]._id
                  ) {
                    mergedData[mergedDataPointer].submissionId =
                      userSurveySubmission.data.data[
                        surveySubmissionPointer
                      ].submissionId;
                    break;
                  }
                }
              }
            }
          }
        }

        let result = {
          programName: programData[0].name,
          programId: programId,
          programEndDate: programData[0].endDate,
          description: programData[0].description
            ? programData[0].description
            : constants.common.TARGETED_SOLUTION_TEXT,
          rootOrganisations:
            programData[0].rootOrganisations &&
            programData[0].rootOrganisations.length > 0
              ? programData[0].rootOrganisations[0]
              : "",
          data: mergedData,
          count: totalCount,
          programEndDate: programData[0].endDate,
        };
        if (programData[0].hasOwnProperty("requestForPIIConsent")) {
          result.requestForPIIConsent = programData[0].requestForPIIConsent;
        }
        //Check data present in programUsers collection.
        //checkForUserJoinedProgramAndConsentShared will returns an object which contain joinProgram and consentShared status.
        let programJoinStatus =
          await programUsersHelper.checkForUserJoinedProgramAndConsentShared(
            programId,
            userId
          );
        result.programJoined = programJoinStatus.joinProgram;
        result.consentShared = programJoinStatus.consentShared;

        return resolve({
          message: constants.apiResponses.PROGRAM_SOLUTIONS_FETCHED,
          success: true,
          data: result,
        });
      } catch (error) {
        return resolve({
          success: false,
          data: {
            description: constants.common.TARGETED_SOLUTION_TEXT,
            data: [],
            count: 0,
          },
        });
      }
    });
  }

  /**
   * User targeted programs.
   * @method
   * @name programs
   * @param {Object} bodyData - request body data.
   * @param {String} pageNo - Page number.
   * @param {String} pageSize - Page size.
   * @param {String} searchText - Search text.
   * @param {String} userId - User Id.
   * @returns {Array} - Get user targeted programs.
   */

  static programs(bodyData, pageNo, pageSize, searchText, userId) {
    return new Promise(async (resolve, reject) => {
      try {
        let programDetails = {};
        let targetedProgramIds = [];
        let nonTargetedProgramIds = [];
        let programCount = 0;

        // getting all program details matching the user profile. not passing pageSize and pageNo to get all data.
        let targetedPrograms = await programsHelper.forUserRoleAndLocation(
          bodyData,
          "", // not passing page size
          "", // not passing page number
          searchText,
          ["_id"]
        );

        // targetedPrograms.data contain all programIds targeted to current user profile.
        if (
          targetedPrograms.success &&
          targetedPrograms.data &&
          targetedPrograms.data.length > 0
        ) {
          targetedProgramIds = gen.utils.arrayOfObjectToArrayOfObjectId(
            targetedPrograms.data
          );
          programCount = targetedPrograms.count;
        }

        // In case user changed profile after joined a program, we need to find the such program details. (programs not targeted to user profile anymore)
        let nontargetedJoinedPrograms =
          await this.getUserJoinedProgramDetailsWithPreviousProfiles(
            targetedProgramIds,
            searchText,
            userId
          );

        if (
          nontargetedJoinedPrograms.success &&
          nontargetedJoinedPrograms.data
        ) {
          nonTargetedProgramIds = nontargetedJoinedPrograms.data;
          programCount = programCount + nontargetedJoinedPrograms.count; // update program count
        }

        //find total number of programs related to user
        let userRelatedPrograms = targetedProgramIds.concat(nonTargetedProgramIds);
        
        if (!userRelatedPrograms.length > 0) {
          throw {
            message: constants.apiResponses.PROGRAM_NOT_FOUND,
          };
        }
        
        // Splitting the userRelatedPrograms array based on the page number and size.
        // The returned data is not coming in the order of userRelatedPrograms elements when all the IDs are passed.
        // We can't add a sort to the programDocuments function because it will also sort programs joined from the previous profile, which should come at the end of the list for us.
        // We have two requirements:
        // 1. Current profile programs should come in the order of their creation.
        // 2. Previous profile programs should always come last.
        let startIndex = pageSize * (pageNo - 1);
        let endIndex = startIndex + pageSize;
        userRelatedPrograms = userRelatedPrograms.slice(startIndex,endIndex) 

        userRelatedPrograms.push("5f35044f19377eecddb06921")
        
        let userRelatedProgramsData = await programsHelper.programDocuments(
          { _id: { $in: userRelatedPrograms }, isAPrivateProgram: false },
          ["name", "externalId", "metaInformation"],
          "none", //not passing skip fields
          "", // not passing pageSize
          "" // not passing pageNo
        );

        if (!userRelatedProgramsData.length > 0) {
          throw {
            message: constants.apiResponses.PROGRAM_NOT_FOUND,
          };
        }
        
        // programDocuments function will not return result in the order which ids are passed. This code block will ensure that the response is rearranged in correct order
        // We can't implement sort logic in programDocuments function because userRelatedPrograms can contain prev profile programs also 
        let programsResult = userRelatedPrograms.map(id => {
          return userRelatedProgramsData.find(data => data._id.toString() === id.toString());
        });
        // to remove null values  from program result as private programs will be not listed
        programsResult = programsResult.filter(element => {return element !== null && element !== undefined})
       
        programDetails.data = programsResult;
        programDetails.count = programsResult.length;
        programDetails.description = constants.apiResponses.PROGRAM_DESCRIPTION;

        return resolve({
          success: true,
          message: constants.apiResponses.PROGRAMS_FETCHED,
          data: programDetails,
        });
      } catch (error) {
        return resolve({
          success: false,
          message: error.message,
          data: {
            description: constants.common.TARGETED_SOLUTION_TEXT,
            data: [],
            count: 0,
          },
        });
      }
    });
  }

  /**
   * List of entity types by location and role.
   * @method
   * @name entityTypesByLocationAndRole
   * @param {String} stateLocationId - state location id.
   * @param {String} role - role.
   * @returns {Object} returns a list of entity type by location and role.
   */
  static entityTypesByLocationAndRole(stateLocationId, role) {
    return new Promise(async (resolve, reject) => {
      try {
        let entityKey = constants.common.SUBENTITY + stateLocationId;
        const rolesDocument = await userRolesHelper.roleDocuments(
          {
            code: role.toUpperCase(),
          },
          ["_id", "entityTypes.entityType"]
        );

        if (!rolesDocument.length > 0) {
          throw {
            message: constants.apiResponses.USER_ROLES_NOT_FOUND,
          };
        }

        let bodyData = {};
        if (gen.utils.checkValidUUID(stateLocationId)) {
          bodyData = {
            id: stateLocationId,
          };
        } else {
          bodyData = {
            code: stateLocationId,
          };
        }

        let entityData = await userService.locationSearch(bodyData);

        if (!entityData.success) {
          throw {
            message: constants.apiResponses.ENTITIES_NOT_EXIST_IN_LOCATION,
          };
        }

        let entityTypes = [];
        let stateEntityExists = false;

        rolesDocument[0].entityTypes.forEach((roleDocument) => {
          if (roleDocument.entityType === constants.common.STATE_ENTITY_TYPE) {
            stateEntityExists = true;
          }
        });

        if (stateEntityExists) {
          entityTypes = [constants.common.STATE_ENTITY_TYPE];
        } else {
          let entitiesMappingForm = await this.entitiesMappingForm(
            entityData.data[0].code,
            rolesDocument[0]._id,
            entityKey
          );

          entitiesMappingForm.result.forEach((entitiesMappingData) => {
            entityTypes.push(entitiesMappingData.field);
          });
        }

        return resolve({
          success: true,
          message: constants.apiResponses.ENTITY_TYPES_FETCHED,
          data: entityTypes,
        });
      } catch (error) {
        return resolve({
          success: false,
          message: error.message,
        });
      }
    });
  }

  /**
   * User Targeted entity.
   * @method
   * @name targetedEntity
   * @param {String} solutionId - solution id
   * @param {Object} requestedData - requested data
   * @returns {Object} - Details of the solution.
   */

  static targetedEntity(solutionId, requestedData) {
    return new Promise(async (resolve, reject) => {
      try {
        let solutionData = await solutionsHelper.solutionDocuments(
          {
            _id: solutionId,
            isDeleted: false,
          },
          ["entityType", "type"]
        );

        if (!solutionData.length > 0) {
          return resolve({
            status: httpStatusCode.bad_request.status,
            message: constants.apiResponses.SOLUTION_NOT_FOUND,
          });
        }
        let rolesDocument = await userRolesHelper.roleDocuments(
          {
            code: requestedData.role,
          },
          ["entityTypes.entityType"]
        );

        if (!rolesDocument.length > 0) {
          throw {
            status: httpStatusCode["bad_request"].status,
            message: constants.apiResponses.USER_ROLES_NOT_FOUND,
          };
        }

        let requestedEntityTypes = Object.keys(_.omit(requestedData, ["role"]));
        let targetedEntityType = "";

        rolesDocument[0].entityTypes.forEach((singleEntityType) => {
          if (requestedEntityTypes.includes(singleEntityType.entityType)) {
            targetedEntityType = singleEntityType.entityType;
          }
        });

        if (!requestedData[targetedEntityType]) {
          throw {
            status: httpStatusCode["bad_request"].status,
            message: constants.apiResponses.ENTITIES_NOT_ALLOWED_IN_ROLE,
          };
        }
        let filterData = {};
        if (solutionData[0].entityType === targetedEntityType) {
          // if solution entity type and user tageted entity type are same
          if (gen.utils.checkValidUUID(requestedData[targetedEntityType])) {
            filterData = {
              parentId: requestedData[targetedEntityType],
            };
            let entitiesData = await userService.locationSearch(filterData);
            if (entitiesData.success) {
              targetedEntityType = constants.common.STATE_ENTITY_TYPE;
            }
          } else if (targetedEntityType === constants.common.SCHOOL) {
            targetedEntityType = constants.common.STATE_ENTITY_TYPE;
          }
        }

        if (gen.utils.checkValidUUID(requestedData[targetedEntityType])) {
          filterData = {
            id: requestedData[targetedEntityType],
          };
        } else {
          filterData = {
            code: requestedData[targetedEntityType],
          };
        }
        let entitiesDocument = await userService.locationSearch(filterData);
        if (!entitiesDocument.success) {
          throw {
            message: constants.apiResponses.ENTITY_NOT_FOUND,
          };
        }

        let entityData = entitiesDocument.data;
        let entityDataFormated = {
          _id: entityData[0].id,
          entityType: entityData[0].type,
          entityName: entityData[0].name,
        };
        return resolve({
          message: constants.apiResponses.SOLUTION_TARGETED_ENTITY,
          success: true,
          data: entityDataFormated,
        });
      } catch (error) {
        return resolve({
          success: false,
          status: error.status
            ? error.status
            : httpStatusCode["internal_server_error"].status,
          message: error.message,
        });
      }
    });
  }

  /**
   * Highest Targeted entity.
   * @method
   * @name getHighestTargetedEntity
   * @param {Object} requestedData - requested data
   * @returns {Object} - Entity.
   */

  static getHighestTargetedEntity(roleWiseTargetedEntities, requestedData) {
    return new Promise(async (resolve, reject) => {
      try {
        let entityKey = constants.common.SUBENTITY + requestedData.state;
        let subEntityTypes = [];
        let cacheData = await cache.getValue(entityKey);

        if (!cacheData) {
          let filterData = {
            id: requestedData.state,
          };

          let entitiesData = await userService.locationSearch(filterData);

          if (!entitiesData.success) {
            return resolve({
              message: constants.apiResponses.ENTITY_NOT_FOUND,
              result: [],
            });
          }
          let stateLocationCode = entitiesData.data[0].code;
          subEntityTypes = await formService.configForStateLocation(
            stateLocationCode,
            entityKey
          );
          if (!subEntityTypes.length > 0) {
            return resolve({
              message: constants.apiResponses.ENTITY_NOT_FOUND,
              result: [],
            });
          }
        } else {
          subEntityTypes = cacheData;
        }

        let targetedIndex = subEntityTypes.length;
        let roleWiseTarget;
        for (
          let roleWiseEntityIndex = 0;
          roleWiseEntityIndex < roleWiseTargetedEntities.length;
          roleWiseEntityIndex++
        ) {
          for (
            let subEntitiesIndex = 0;
            subEntitiesIndex < subEntityTypes.length;
            subEntitiesIndex++
          ) {
            if (
              roleWiseTargetedEntities[roleWiseEntityIndex].entityType ==
              subEntityTypes[subEntitiesIndex]
            ) {
              if (subEntitiesIndex < targetedIndex) {
                targetedIndex = subEntitiesIndex;
                roleWiseTarget = roleWiseEntityIndex;
              }
            }
          }
        }
        let targetedEntity = roleWiseTargetedEntities[roleWiseTarget];
        return resolve({
          message: constants.apiResponses.SOLUTION_TARGETED_ENTITY,
          success: true,
          data: targetedEntity,
        });
      } catch (error) {
        return resolve({
          success: false,
          status: error.status
            ? error.status
            : httpStatusCode["internal_server_error"].status,
          message: error.message,
        });
      }
    });
  }

  /**
   * Find non-targeted joined program.
   * @method
   * @name getUserJoinedProgramDetailsWithPreviousProfiles
   * @param {Array} targetedProgramIds - programIds
   * @param {String} searchText - search text
   * @param {String} userId - userId
   * @returns {Object} - non-targeted joined program details.
   */
  static getUserJoinedProgramDetailsWithPreviousProfiles(
    targetedProgramIds,
    searchText = "",
    userId
  ) {
    return new Promise(async (resolve, reject) => {
      try {
        let programUsersIds = [];
        let nonTargettedProgramDetails = [];

        // find all programs joined by the user
        // programUsersData will contain list of programs joined by user from all the profiles. This can be considered as the super set of user programs
        let programUsersData = await programUsersHelper.programUsersDocuments(
          {
            userId: userId,
          },
          ["programId"]
        );

        if (programUsersData.length > 0) {
          programUsersIds = programUsersData.map(function (obj) {
            return obj.programId;
          });
        }

        // if we find the difference between programUsersData and targettedProgramIds we will get program details joined by user other than the current profile
        let previousProfilesJoinedProgramIds = _.differenceWith(
          programUsersIds,
          targetedProgramIds,
          _.isEqual
        );

        if (previousProfilesJoinedProgramIds.length > 0) {
          let findQuery = {
            _id: { $in: previousProfilesJoinedProgramIds },
            startDate: { $lte: new Date() },
            endDate: { $gte: new Date() },
          };

          //call program details to check if the program is active or not
          let programDetails = await programsHelper.list(
            "", // not passing page number
            "", // not passing page size
            searchText,
            findQuery,
            ["_id"]
          );

          // get _ids to array
          if (
            programDetails.success > 0 &&
            programDetails.data &&
            programDetails.data.data &&
            programDetails.data.data.length > 0
          ) {
            nonTargettedProgramDetails =
              gen.utils.arrayOfObjectToArrayOfObjectId(
                programDetails.data.data
              );
          }
        }

        return resolve({
          success: true,
          data: nonTargettedProgramDetails,
          count: nonTargettedProgramDetails.length,
        });
      } catch (error) {
        return resolve({
          success: false,
          status: error.status
            ? error.status
            : httpStatusCode["internal_server_error"].status,
          message: error.message,
        });
      }
    });
  }
};

/**
 * Generate program creation data.
 * @method
 * @name _createProgramData
 * @returns {Object} - program creation data
 */

function _createProgramData(
  name,
  externalId,
  isAPrivateProgram,
  status,
  description,
  userId,
  startDate,
  endDate,
  createdBy = ""
) {
  let programData = {};
  programData.name = name;
  programData.externalId = externalId;
  programData.isAPrivateProgram = isAPrivateProgram;
  programData.status = status;
  programData.description = description;
  programData.userId = userId;
  programData.createdBy = createdBy;
  programData.startDate = startDate;
  programData.endDate = endDate;
  return programData;
}

/**
 * Generate solution creation data.
 * @method
 * @name _createSolutionData
 * @returns {Object} - solution creation data
 */

function _createSolutionData(
  name = "",
  externalId = "",
  isAPrivateProgram = "",
  status,
  description = "",
  userId,
  isReusable = "",
  parentSolutionId = "",
  type = "",
  subType = "",
  updatedBy = ""
) {
  let solutionData = {};
  solutionData.name = name;
  solutionData.externalId = externalId;
  solutionData.isAPrivateProgram = isAPrivateProgram;
  solutionData.status = status;
  solutionData.description = description;
  solutionData.userId = userId;
  if (parentSolutionId) {
    solutionData.parentSolutionId = parentSolutionId;
  }
  if (type) {
    solutionData.type = type;
  }
  if (subType) {
    solutionData.subType = subType;
  }
  if (updatedBy) {
    solutionData.updatedBy = updatedBy;
  }
  if (isReusable) {
    solutionData.isReusable = isReusable;
  }

  return solutionData;
}
