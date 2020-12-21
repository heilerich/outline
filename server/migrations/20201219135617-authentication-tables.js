'use strict';

const { v4: uuidv4 } = require('uuid');

const TABLE_NAMES = {
  PROVIDER: 'authentication_providers',
  USERPROVIDER: 'user_authentication_providers',
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.createTable(TABLE_NAMES.PROVIDER, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4
        },
        plugin: {
          type: Sequelize.STRING,
          allowNull: false
        },
        externalTeamId: {
          type: Sequelize.STRING,
          allowNull: false
        },
        teamId: {
          type: Sequelize.UUID,
          references: {
            model: {
              tableName: 'teams'
            },
            key: 'id'
          },
          allowNull: false
        },
        data: {
          type: Sequelize.JSONB
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      })
      await queryInterface.createTable(TABLE_NAMES.USERPROVIDER, {
        id: {
          type: Sequelize.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: Sequelize.UUIDV4
        },
        externalUserId: {
          type: Sequelize.STRING,
          allowNull: false
        },
        userId: {
          type: Sequelize.UUID,
          references: {
            model: {
              tableName: 'users'
            },
            key: 'id'
          },
          allowNull: false
        },
        authenticationProviderId: {
          type: Sequelize.UUID,
          references: {
            model: {
              tableName: TABLE_NAMES.PROVIDER
            },
            key: 'id'
          },
          allowNull: false
        },
        isTeamAdmin: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        data: {
          type: Sequelize.JSONB
        },
        createdAt: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.NOW
        },
        updatedAt: {
          allowNull: false,
          type: Sequelize.DATE
        }
      })

      const [teams, metadata] = await queryInterface.sequelize.query(`
        SELECT "id", "slackId", "slackData", "googleId" FROM teams
      `)
      await Promise.all(teams.map(team => {
        try {
          var providers = []
          const now = new Date()
          if (team.slackId) {
            providers.push({
              id: uuidv4(),
              plugin: 'slack',
              externalTeamId: team.slackId,
              data: team.slackData,
              teamId: team.id,
              createdAt: now,
              updatedAt: now
            })
          }
          if (team.googleId) {
            providers.push({
              id: uuidv4(),
              plugin: 'google',
              externalTeamId: team.googleId,
              teamId: team.id,
              createdAt: now,
              updatedAt: now
            })
          }
          return queryInterface.bulkInsert(TABLE_NAMES.PROVIDER, providers)
        } catch (err) {
          return Promise.reject(err)
        }
      }))

      const [users,] = await queryInterface.sequelize.query(`
        SELECT "id", "isAdmin", "serviceId", "service", "teamId" FROM users;
      `)
      await Promise.all(users.map(async user => {
        const now = new Date()

        try {
          const provider = (await queryInterface.sequelize.query(`
            SELECT "id" FROM ${TABLE_NAMES.PROVIDER}
            WHERE "plugin" = ? and "teamId" = ?
          `, {
            replacements: [user.service, user.teamId],
            type: Sequelize.QueryTypes.SELECT
          }))[0]

          return queryInterface.bulkInsert(TABLE_NAMES.USERPROVIDER, [{
            id: uuidv4(),
            userId: user.id,
            externalUserId: user.serviceId,
            isTeamAdmin: user.isAdmin,
            authenticationProviderId: provider.id,
            createdAt: now,
            updatedAt: now
          }])
        } catch (err) {
          return Promise.reject(err)
        }
      }))

      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      queryInterface.dropTable(TABLE_NAMES.USERPROVIDER)
      queryInterface.dropTable(TABLE_NAMES.PROVIDER)
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      throw err
    }
  }
};
