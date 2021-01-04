// @flow
import { DataTypes, sequelize } from "../sequelize";

const AuthenticationProvider = sequelize.define(
  "authentication_provider",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    plugin: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    externalTeamId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSONB,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["plugin", "externalTeamId"],
        name: "unique_plugin_external_id",
      },
    ],
  }
);

AuthenticationProvider.associate = (models) => {
  AuthenticationProvider.belongsTo(models.Team, {
    as: "team",
    foreignKey: "teamId",
    allowNull: false,
  });
  AuthenticationProvider.hasMany(models.UserAuthenticationProvider, {
    as: "userAuthentications",
  });
};

export default AuthenticationProvider;
