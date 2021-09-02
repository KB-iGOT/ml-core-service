module.exports = {
    name: "programs",
    schema: {
      externalId: String,
      name: String,
      description: String,
      owner: String,
      createdBy: String,
      updatedBy: String,
      status: String,
      resourceType: [String],
      language: [String],
      keywords: [String],
      concepts: ["json"],
      imageCompression: {},
      components: ["json"],
      components: ["json"],
      isAPrivateProgram : {
        default : false,
        type : Boolean
      },
      scope : {
        entityType : String,
        entityTypeId : "ObjectId",
        entities : {
          type : Array,
          index : true
        },
        roles : [{
          _id : "ObjectId",
          code : {
            type : String,
            index : true
          }
        }]
      },
      isDeleted: {
        default : false,
        type : Boolean
      }
    }
  };
  