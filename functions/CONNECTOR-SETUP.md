# Registering the sign-in connectors

Every app below uses the same redirect address:

    https://us-central1-aibram-9c44f.cloudfunctions.net/eternityOAuthCallback

For each one: make the developer app, paste the redirect address, turn on the read permissions listed, then put the Client ID and Client Secret into `functions/connector-apps.json` under the key shown. Never commit that file.

| Key in connector-apps.json | Where to register | Turn on (read only) | Notes |
|---|---|---|---|
| todoist | developer.todoist.com/appconsole.html | data:read | OAuth redirect URL |
| dropbox | dropbox.com/developers/apps | files.metadata.read, files.content.read | Starts limited to a few users until you apply for production |
| gitlab | gitlab.com/-/user_settings/applications | read_api | Keep Confidential checked |
| microsoft | entra.microsoft.com, App registrations | User.Read, Mail.Read, Calendars.Read, Files.Read, Tasks.Read, Notes.Read (delegated) | Choose "Accounts in any organizational directory and personal Microsoft accounts". Platform: Web. Make a client secret and copy its Value |
| airtable | airtable.com/create/oauth | data.records:read, schema.bases:read | Needs PKCE, already handled |
| atlassian | developer.atlassian.com/console/myapps | Jira API: read:jira-work, read:jira-user. Confluence API: read:confluence-content.all, search:confluence | OAuth 2.0 (3LO). Set Distribution to Sharing before others can sign in |
| asana | app.asana.com/0/my-apps | default | |
| zoom | marketplace.zoom.us, Develop, Build App, General app | meeting:read | Other people can only sign in after Zoom approves the app |
| twitch | dev.twitch.tv/console | user:read:follows (requested at sign-in) | Category: Application Integration |
| vimeo | developer.vimeo.com/apps | public, private | |
| eventbrite | eventbrite.com/platform/api-keys | default | Client secret is the "Client Secret" next to the API key |
| square | developer.squareup.com/apps | PAYMENTS_READ, ORDERS_READ | Use the Production credentials |
| mailchimp | admin.mailchimp.com/account/oauth2 | default | |
| wordpress | developer.wordpress.com/apps | default | WordPress.com sites only |
| planningcenter | api.planningcenteronline.com/oauth/applications | services | |
| hubspot | developers.hubspot.com, make a developer account, Create app, Auth tab | crm.objects.contacts.read, crm.objects.deals.read | |
| clickup | ClickUp avatar, Settings, Apps, Create an App | default | |
| typeform | admin.typeform.com/account, Developer apps | accounts:read, forms:read, responses:read | |
| box | app.box.com/developers/console, Create Platform App, Custom App, User Authentication (OAuth 2.0) | Read all files and folders | |

Google Sheets, Tasks, Classroom and Contacts reuse the Google app you already have. Once Google is registered, add those four scopes to its consent screen:
spreadsheets.readonly, tasks.readonly, classroom.courses.readonly, classroom.coursework.me.readonly, contacts.readonly.

Vercel, Netlify, Printify, Printful, Mastodon and Trello need nothing here: each person pastes their own token.
