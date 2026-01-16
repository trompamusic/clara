# CLARA Rehearsal companion for instrumental players

CLARA (Companion for Long-term Analyses of Rehearsal Attempts) is a rehearsal companion for instrumental players under development as part of the TROMPA Project: Towards Richer Online Music Public-domain Archives

Public demo available here: https://trompa.mdw.ac.at

For more information on TROMPA, consult https://trompamusic.eu

CLARA is implemented as a MELD application; see http://github.com/oerc-music/meld

Documentation to follow.

This project has received funding from the European Union's Horizon 2020 research and innovation programme H2020-EU.3.6.3.1. - Study European heritage, memory, identity, integration and cultural interaction and translation, including its representations in cultural and scientific collections, archives and museums, to better inform and understand the present by richer interpretations of the past under grant agreement No 770376.

## Local development

This application works in parallel with [`trompa-align`](https://github.com/trompamusic/trompa-align), you need to also set up
that project

We use the `"proxy"` flag in package.json to seamlessly send API requests to trompa-align. In development the default setup
should work, but if you run trompa-align in a different location then you may need to change this.

In order to provide a seamless experience to users, we take advantage of Solid [Client ID Documents](https://solidproject.org/TR/oidc#clientids-document). This means that there must be a public URL pointing to the document. Follow the instructions
in trompa-align to configure this. Once you have a URL, put it in the `.env` file:

    REACT_APP_CLIENT_ID_DOCUMENT_URL=https://your-id.ngrok-free.app/clara.jsonld

### Dependencies

This application currently requires Node 18 to run. Don't run with a newer version, it might not work.

## Production deployment
