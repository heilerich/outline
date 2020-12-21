'use strict';

const { migrateUsers, migrateTeams } = require('./20201219135617-authentication-tables')

const TABLE_NAMES = {
  PROVIDER: 'authentication_providers',
  USERPROVIDER: 'user_authentication_providers',
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      /* 
        Copy data of items in users and teams that were created after the
        first authentication migration step was run and were not yet copied
        to the new tables.
      */
      const lastMigratedTeam = (await queryInterface.sequelize.query(`
        SELECT MAX("createdAt") FROM ${TABLE_NAMES.PROVIDER};
      `, { type: Sequelize.QueryTypes.SELECT, transaction }))[0].max
      const lastMigratedUser = (await queryInterface.sequelize.query(`
        SELECT MAX("createdAt") FROM ${TABLE_NAMES.USERPROVIDER};
      `, { type: Sequelize.QueryTypes.SELECT, transaction }))[0].max

      await migrateTeams(queryInterface, Sequelize, transaction, lastMigratedTeam)
      await migrateUsers(queryInterface, Sequelize, transaction, lastMigratedUser)

      await queryInterface.removeColumn('users', 'isAdmin', { transaction })
      await queryInterface.removeColumn('users', 'serviceId', { transaction })
      await queryInterface.removeColumn('users', 'service', { transaction })
      await queryInterface.removeColumn('users', 'teamId', { transaction })
      await queryInterface.removeColumn('users', 'slackData', { transaction })

      await queryInterface.removeColumn('teams', 'slackId', { transaction })
      await queryInterface.removeColumn('teams', 'slackData', { transaction })
      await queryInterface.removeColumn('teams', 'googleId', { transaction })

      await transaction.commit()
    } catch (err) {
      console.error('Migration failed, rolling back')
      await transaction.rollback()
      throw err
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction()
    try {
      await queryInterface.addColumn('users', 'isAdmin', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      }, { transaction })
      await queryInterface.addColumn('users', 'serviceId', {
        type: Sequelize.STRING,
      }, { transaction })
      await queryInterface.addColumn('users', 'service', {
        type: Sequelize.STRING,
        defaultValue: 'slack',
      }, { transaction })
      await queryInterface.addColumn('users', 'teamId', {
        type: Sequelize.UUID,
        references: {
          model: {
            tableName: 'teams'
          },
          key: 'id'
        },
      }, { transaction })
      await queryInterface.addColumn('users', 'slackData', {
        type: Sequelize.JSONB,
      }, { transaction })

      await queryInterface.addColumn('teams', 'slackId', {
        type: Sequelize.STRING,
      }, { transaction })
      await queryInterface.addColumn('teams', 'slackData', {
        type: Sequelize.JSONB,
      }, { transaction })
      await queryInterface.addColumn('teams', 'googleId', {
        type: Sequelize.STRING,
      }, { transaction })

      const providers = await queryInterface.sequelize.query(`
        SELECT "id", "plugin", "teamId", "externalTeamId", "data" FROM ${TABLE_NAMES.PROVIDER}
      `, { type: Sequelize.QueryTypes.SELECT, transaction })

      await Promise.all(providers.map(async provider => {
        return queryInterface.sequelize.query(`
          UPDATE teams
          SET "slackId" = COALESCE(:slackId, "slackId"),
              "googleId" = COALESCE(:googleId, "googleId"),
              "slackData" = COALESCE(:slackData, "slackData")
          WHERE id = :teamId;
        `, {
          replacements: {
            slackId: provider.plugin == 'slack' ? provider.externalTeamId : null,
            slackData: provider.plugin == 'slack' ? provider.data : null,
            googleId: provider.plugin == 'google' ? externalTeamId : null,
            teamId: provider.teamId
          },
          transaction
        })
      }))

      const userAuthentications = await queryInterface.sequelize.query(`
        SELECT "externalUserId", "userId", "isTeamAdmin", ${TABLE_NAMES.USERPROVIDER}."data",
          ${TABLE_NAMES.PROVIDER}."plugin", ${TABLE_NAMES.PROVIDER}."teamId" 
        FROM ${TABLE_NAMES.USERPROVIDER}
        INNER JOIN ${TABLE_NAMES.PROVIDER}
        ON ${TABLE_NAMES.USERPROVIDER}."authenticationProviderId" = ${TABLE_NAMES.PROVIDER}.id
      `, { type: Sequelize.QueryTypes.SELECT, transaction })

      await Promise.all(userAuthentications.map(async userAuth => {
        return queryInterface.sequelize.query(`
          UPDATE users
          SET "isAdmin" = :isAdmin,
              "serviceId" = :serviceId,
              "service" = :service,
              "teamId" = :teamId,
              "slackData" = COALESCE(:slackData, "slackData")
          WHERE id = :userId;
        `, {
          replacements: {
            isAdmin: userAuth.isTeamAdmin,
            serviceId: userAuth.externalUserId,
            service: userAuth.plugin,
            teamId: userAuth.teamId,
            slackData: userAuth.plugin == 'slack' ? userAuth.data : null,
            userId: userAuth.userId
          },
          transaction
        })
      }))

      await transaction.commit()
    } catch (err) {
      console.error('Migration failed, rolling back')
      await transaction.rollback()
      throw err
    }
  }
};
