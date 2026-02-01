/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1579384326",
        "max": 0,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select1368277760",
        "maxSelect": 0,
        "name": "visibility",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "public",
          "unlisted",
          "private"
        ]
      },
      {
        "hidden": false,
        "id": "select110234162",
        "maxSelect": 0,
        "name": "join_mode",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "open",
          "pin",
          "invite_only"
        ]
      },
      {
        "hidden": false,
        "id": "bool2142241043",
        "name": "approval_required",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "bool3022170763",
        "name": "allow_anonymous_uploads",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text1997877400",
        "max": 0,
        "min": 0,
        "name": "code",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "number2409176460",
        "max": null,
        "min": null,
        "name": "storage_limit_mb",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number674203781",
        "max": null,
        "min": null,
        "name": "storage_used_mb",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "bool509869836",
        "name": "view_only",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_1687431684",
    "indexes": [],
    "listRule": null,
    "name": "events",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": null
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1687431684");

  return app.delete(collection);
})
