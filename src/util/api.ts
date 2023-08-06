import axios, {AxiosInstance} from 'axios';

class Api {
    private client: AxiosInstance;
    constructor() {
        this.client = axios.create({
            baseURL: process.env.REACT_APP_API_URL,
            timeout: 5000,
        });
    }

    swrQuery = (query: string) => {
        return this.client.get(query).then(result => {
            return result.data;
        });
    }

    getBackendAuthenticationUrl = (profile: string, redirect_after: string) => {
        const data = new FormData();
        data.append('webid_or_provider', profile);
        data.append('redirect_after', redirect_after);
        return this.client.post(`/api/auth/request`, data).then(result => {
            return result.data;
        });
    }

    doAuthCallback = (code: string, state: string) => {
        const data = new FormData();
        data.append('code', code);
        data.append('state', state);
        return this.client.post(`/api/auth/callback`, data).then(result => {
            return result.data;
        });
    }

    alignMidi = (profile: string, score: string, file: Blob) => {
        let data = new FormData();

        data.append("file", file);
        data.append("midi_type", "midi");
        data.append("score", score);
        data.append("profile", profile);

        return this.client.post('/api/align', data).then((result) => {
            return result.data;
        });
    }

    alignWebMidi = (profile: string, score: string, webMidi: string) => {
        let data = new FormData();

        const blob = new Blob([webMidi], {type: "application/json"});

        data.append("file", blob);
        data.append("midi_type", "webmidi");
        data.append("score", score);
        data.append("profile", profile);

        return this.client.post('/api/align', data).then((result) => {
            return result.data;
        });
    }

    addScore = (score: string, profile: string) => {
        const data = {
            score,
            profile,
        };
        return this.client.post(`/api/add`, data).then(result => {
            return result.data;
        });
    }

    checkUserPermissions = (profile: string) => {
        const profileParams = new URLSearchParams({
            profile
        });
        return this.client.get(`/api/check_user_perms?${profileParams}`).then(result => {
            return result.data;
        })
    }

}

const ApiInstance = new Api();
export default ApiInstance;
