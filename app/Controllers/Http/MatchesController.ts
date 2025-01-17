import type { HttpContextContract } from "@ioc:Adonis/Core/HttpContext";
import { schema } from '@ioc:Adonis/Core/Validator'

import User from "App/Models/User";
import Match from "App/Models/Match";
import CreateMatchValidator from "App/Validaors/CreateMatchValidator";

export default class MatchesController {
  //retrive list of user's based on there gender preference
  public async get({ response, auth }: HttpContextContract) {
    try {
      const userId = auth.user?.id;
      if (!userId) {
        return response.json({
          message: "kindly login",
        });
      }

      const currentUser = await User.query()
        .where("id", userId)
        .preload("profile")
        .first();
      const profile = currentUser?.profile;

      if (!profile?.preferedGenderId) return response.json("Profile not exist");

      const users = await User.query()
        .whereNot("id", userId)
        .preload("profile")
        .with("profile", (q) => {
          q.where("prefered_gender_id", profile.preferedGenderId);
        });

      const mappedUsers = users?.map((u) => {
        return {
          id: u.id,
          name: u.name,
          avatar: u?.profile?.avatar,
        };
      });
      return response.json({
        data: mappedUsers,
      });
    } catch (err) {
      console.log("errrrr", err);
    }
  }

  public async mutualMatch({ request, response, auth }: HttpContextContract) {
    try {
      const authId = auth.user?.id;
      if (!authId) {
        response.status(401);
        return;
      }

      const payload = await request.validate(CreateMatchValidator);
      const { userId } = payload;
      if(authId == userId) {
        return response.json({
          message: "Cannot mark youself as match."
        })
      }

      const userExist = await User.query().where("id", userId).first();
      if(!userExist) {
        return response.json({
          message: "User not found."
        })
      }

      const matchExist = await Match.query()
        .where("matcher_user_id", userId)
        .where("matched_user_id", authId)
        .first();

      if (matchExist) {
        await Match.query().where("id", matchExist.id).update({
          mutual_match: 1,
          match_date: new Date(),
        });

        const matchedUser = await User.query()
          .where("id", userId)
          .select("name", "email")
          // .preload("profile")
          .first();

        const userData = {
          name: matchedUser?.name,
          email: matchedUser?.email,
        };

        return response.json({
          message: "It's a mutual match",
          data: userData,
        });
      }

      const newMatch = new Match();
      newMatch.matcherUserId = authId;
      newMatch.matchedUserId = userId;
      await newMatch.save();

      return response.json({
        message: "Match has been marked.",
      });
    } catch (err) {
      return response.json({
        message: "Something went wrong.",
        errors: err?.messages?.errors,
      });
    }
  }
  public async history({ response, auth }: HttpContextContract) {
    try {
      const authId = auth.user?.id;
      if (!authId) {
        return response.json({
          message: "kindly login",
        });
      }

      const matchHistory = await Match.query()
        .where("matcher_user_id", authId)
        .orWhere("matched_user_id", authId)
        .where("mutual_match", 1);

      const userIds = matchHistory?.map((history: Match) => {
        return history.matcherUserId == authId
          ? String(history.matchedUserId)
          : String(history.matcherUserId);
      });

      const users = await User.query()
        .whereIn("id", userIds)
        .select("name", "email")

      return response.json({
        data: users,
        message: "Mutual match history.",
      });
    } catch (err) {
      return response.json({
        message: "Something went wrong.",
      });
    }
  }
}
