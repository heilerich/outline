"use strict";

const { Sequelize } = require("sequelize");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAMES = {
  PROVIDER: "authentication_providers",
  USERPROVIDER: "user_authentication_providers",
};

const migrateTeams = async (
  queryInterface,
  Sequelize,
  transaction,
  dateFilter
) => {
  const teams = await queryInterface.sequelize.query(
    `
    SELECT "id", "slackId", "slackData", "googleId" FROM teams
    ${dateFilter ? 'WHERE "createdAt" > :minDate' : ""};
  `,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: { minDate: dateFilter },
      transaction,
    }
  );
  await Promise.all(
    teams.map((team) => {
      var providers = [];
      const now = new Date();
      if (team.slackId) {
        providers.push({
          id: uuidv4(),
          plugin: "slack",
          externalTeamId: team.slackId,
          data: team.slackData,
          teamId: team.id,
          createdAt: now,
          updatedAt: now,
        });
      }
      if (team.googleId) {
        providers.push({
          id: uuidv4(),
          plugin: "google",
          externalTeamId: team.googleId,
          teamId: team.id,
          createdAt: now,
          updatedAt: now,
        });
      }
      providers.push({
        id: uuidv4(),
        pluing: "email",
        externalTeamId: team.id,
        teamId: team.id,
        createdAt: now,
        updatedAt: now,
      });
      return queryInterface.bulkInsert(TABLE_NAMES.PROVIDER, providers, {
        transaction,
      });
    })
  ).catch((err) => {
    throw err;
  });
};

const migrateUsers = async (
  queryInterface,
  Sequelize,
  transaction,
  dateFilter
) => {
  // TODO: bulkUpdate Users with empty service with service 'email' serviceId 'user.email'
  const users = await queryInterface.sequelize.query(
    `
    SELECT users."id", "isAdmin", "serviceId", "slackData",
      ${TABLE_NAMES.PROVIDER}.id AS "providerId", ${
      TABLE_NAMES.PROVIDER
    }."plugin"
    FROM users
    INNER JOIN ${TABLE_NAMES.PROVIDER}
    ON users."teamId" = ${TABLE_NAMES.PROVIDER}."teamId" 
      and users."service" = ${TABLE_NAMES.PROVIDER}."plugin"
    ${dateFilter ? 'WHERE users."createdAt" > :minDate' : ""};
  `,
    {
      type: Sequelize.QueryTypes.SELECT,
      replacements: { minDate: dateFilter },
      transaction,
    }
  );

  await Promise.all(
    users.map(async (user) => {
      const now = new Date();
      return queryInterface.bulkInsert(
        TABLE_NAMES.USERPROVIDER,
        [
          {
            id: uuidv4(),
            userId: user.id,
            externalUserId: user.serviceId,
            isTeamAdmin: user.isAdmin,
            authenticationProviderId: user.providerId,
            createdAt: now,
            updatedAt: now,
            ...(user.plugin == "slack" ? { data: user.slackData } : null),
          },
        ],
        { transaction }
      );
    })
  ).catch((err) => {
    throw err;
  });
};

module.exports = {
  migrateTeams,
  migrateUsers,
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.createTable(
        TABLE_NAMES.PROVIDER,
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
          },
          plugin: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          externalTeamId: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          teamId: {
            type: Sequelize.UUID,
            references: {
              model: {
                tableName: "teams",
              },
              key: "id",
            },
            allowNull: false,
          },
          data: {
            type: Sequelize.JSONB,
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex(TABLE_NAMES.PROVIDER, {
        unique: true,
        fields: ["plugin", "externalTeamId"],
        name: "unique_plugin_external_id",
      });

      await queryInterface.createTable(
        TABLE_NAMES.USERPROVIDER,
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: Sequelize.UUIDV4,
          },
          externalUserId: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          userId: {
            type: Sequelize.UUID,
            references: {
              model: {
                tableName: "users",
              },
              key: "id",
            },
            allowNull: false,
          },
          authenticationProviderId: {
            type: Sequelize.UUID,
            references: {
              model: {
                tableName: TABLE_NAMES.PROVIDER,
              },
              key: "id",
            },
            allowNull: false,
          },
          isTeamAdmin: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          data: {
            type: Sequelize.JSONB,
          },
          createdAt: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
          },
          updatedAt: {
            allowNull: false,
            type: Sequelize.DATE,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex(TABLE_NAMES.PROVIDER, {
        unique: true,
        fields: ["authenticationProvider", "externalUserId"],
        name: "unique_provider_external_user_id",
      });

      await migrateTeams(queryInterface, Sequelize, transaction);
      await migrateUsers(queryInterface, Sequelize, transaction);

      await transaction.commit();
    } catch (err) {
      console.error("Migration failed, rolling back");
      await transaction.rollback();
      throw err;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.dropTable(TABLE_NAMES.USERPROVIDER, { transaction });
      await queryInterface.dropTable(TABLE_NAMES.PROVIDER, { transaction });
      await transaction.commit();
    } catch (err) {
      console.error("Migration failed, rolling back");
      await transaction.rollback();
      throw err;
    }
  },
};
