import xml2js from 'xml2js';
import url from 'url';
import { check } from 'meteor/check';
import Logger from '/imports/startup/server/logger';
import Breakouts from './../../';

const xmlParser = new xml2js.Parser();

const getUrlParams = (urlToParse) => {
  const options = { parseQueryString: true };
  const parsedUrl = url.parse(urlToParse, options);
  return parsedUrl.query;
};

export default function handleBreakoutJoinURL({ body }) {
  const {
    noRedirectJoinURL,
    userId,
  } = body;

  check(noRedirectJoinURL, String);

  const urlParams = getUrlParams(noRedirectJoinURL);

  const selector = {
    externalMeetingId: urlParams.meetingID,
  };

  let breakout = Breakouts.findOne(selector);

  const res = Meteor.http.call('get', noRedirectJoinURL);
  xmlParser.parseString(res.content, (err, parsedXML) => {
    if (err) {
      return Logger.error(`An Error occured when parsing xml response for: ${noRedirectJoinURL}`);
    }

    breakout = Breakouts.findOne(selector);

    const { response } = parsedXML;
    const users = breakout.users;

    const user = {
      userId,
      urlParams: {
        meetingId: response.meeting_id[0],
        userId: response.user_id[0],
        authToken: response.auth_token[0],
      },
    };

    const userExists = users.find(u => user.userId === u.userId);

    if (userExists) {
      return;
    }

    const modifier = {
      $push: {
        users: user,
      },
    };

    const cb = (err, numChanged) => {
      if (err) {
        return Logger.error(`Adding breakout to collection: ${err}`);
      }

      const {
        insertedId,
      } = numChanged;
      if (insertedId) {
        return Logger.info(`Added breakout id=${urlParams.meetingID}`);
      }

      return Logger.info(`Upserted breakout id=${urlParams.meetingID}`);
    };

    return Breakouts.upsert(selector, modifier, cb);
  });
}
