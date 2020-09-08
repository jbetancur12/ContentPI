// Dependencies
import { Op } from 'sequelize'
import { getEntries } from 'fogg-utils'

// Interfaces
import {
  iValue,
  iCreateOrUpdateValueInput,
  iValueInput,
  iModels
} from '../../interfaces'

export default {
  Query: {
    getValuesByEntry: async (
      _: any,
      { entry }: { entry: string },
      { models }: { models: iModels }
    ): Promise<iValue[]> => {
      const values = await models.Value.findAll({
        where: {
          entry
        }
      })

      return values
    },
    getEntriesByModelId: async (
      _: any,
      { modelId }: { modelId: string },
      { models }: { models: iModels }
    ): Promise<any> => {
      const allEntriesPromises: any[] = []

      const references = await models.Reference.findAll({
        where: {
          parentModel: modelId
        }
      })

      if (references.length > 0) {
        references.forEach((reference: any) => {
          const promise = new Promise((resolve: any) => {
            models.Field.findAll({
              where: {
                model_id: reference.targetModel
              },
              include: [
                {
                  model: models.Value,
                  as: 'values'
                }
              ]
            }).then((fields: any) => {
              const [{ modelName }] = fields
              const { entries } = getEntries(fields)

              resolve({
                modelId: reference.targetModel,
                modelName,
                entries
              })
            })
          })

          allEntriesPromises.push(promise)
        })
      }

      const entries = await Promise.all(allEntriesPromises)

      return {
        entries: JSON.stringify(entries)
      }
    }
  },
  Mutation: {
    createValues: async (
      _: any,
      { input }: { input: iCreateOrUpdateValueInput[] },
      { models }: { models: iModels }
    ): Promise<iValue[]> => {
      const insertedValues = await models.Value.bulkCreate(input)

      return insertedValues
    },
    findUniqueValues: async (
      _: any,
      { input }: { input: iValueInput[] },
      { models }: { models: iModels }
    ): Promise<any> => {
      const data = await models.Value.findAll({
        where: {
          [Op.or]: input
        }
      })

      return data
    },
    updateValues: async (
      _: any,
      { entry, input }: { entry: string; input: iCreateOrUpdateValueInput[] },
      { models }: { models: iModels }
    ): Promise<any> => {
      const updatedValuesPromises: any = []

      if (input) {
        input.forEach((item: any) => {
          const updateValuePromise = new Promise((resolve: any) => {
            models.Value.findAll({
              where: {
                entry,
                fieldId: item.fieldId
              }
            }).then((valueToEdit: any) => {
              if (valueToEdit[0]) {
                valueToEdit[0]
                  .update(
                    { ...item },
                    {
                      where: {
                        entry,
                        fieldId: item.fieldId
                      },
                      returning: true,
                      plain: true
                    }
                  )
                  .then((updatedValue: any) => resolve(updatedValue))
              } else if (item.entry && item.fieldId) {
                // Creating values that did not exists before...
                models.Value.create(item).then((createdValue: any) =>
                  resolve(createdValue)
                )
              }
            })
          })

          updatedValuesPromises.push(updateValuePromise)
        })
      }

      const newValues = await Promise.all(updatedValuesPromises)

      return newValues
    }
  }
}
