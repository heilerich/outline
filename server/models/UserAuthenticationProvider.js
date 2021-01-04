// @flow
import { Sequelize } from "sequelize";
import { DataTypes, sequelize } from "../sequelize";

const UserAuthenticationProvider = sequelize.define(
  "user_authentication_provider",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    externalUserId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isTeamAdmin: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    data: {
      type: DataTypes.JSONB,
    },
  },
  {
    indexes: [
      {
        unique: true,
        fields: ["authenticationProvider", "externalUserId"],
        name: "unique_provider_external_user_id",
      },
    ],
  }
);

UserAuthenticationProvider.associate = (models) => {
  UserAuthenticationProvider.belongsTo(models.User, {
    as: "user",
    foreignKey: "userId",
    allowNull: false,
  });
  UserAuthenticationProvider.belongsTo(models.AuthenticationProvider, {
    as: "provider",
    foreignKey: "authenticationProviderId",
    allowNull: false,
  });
};

export default UserAuthenticationProvider;
