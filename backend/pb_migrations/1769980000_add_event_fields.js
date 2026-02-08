/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const collection = app.findCollectionByNameOrId("events")

    // Description
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "events_description",
        "name": "description",
        "type": "text",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
            "min": null,
            "max": null,
            "pattern": ""
        }
    }))

    // Start Date
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "events_start_date",
        "name": "start_date",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
            "min": "",
            "max": ""
        }
    }))

    // End Date
    collection.schema.addField(new SchemaField({
        "system": false,
        "id": "events_end_date",
        "name": "end_date",
        "type": "date",
        "required": false,
        "presentable": false,
        "unique": false,
        "options": {
            "min": "",
            "max": ""
        }
    }))

    return app.save(collection)
}, (app) => {
    const collection = app.findCollectionByNameOrId("events")

    // verify if field exists before deleting to avoid errors
    const fields = ["description", "start_date", "end_date"]
    fields.forEach(name => {
        try {
            const field = collection.schema.getFieldByName(name)
            if (field) {
                collection.schema.removeField(field.id)
            }
        } catch (e) {
            // ignore error if field doesn't exist
        }
    })

    return app.save(collection)
})
