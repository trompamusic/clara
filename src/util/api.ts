import axios, {AxiosInstance} from 'axios';

class Api {
    private client: AxiosInstance;
    constructor() {
        this.client = axios.create({
            baseURL: process.env.REACT_APP_API_URL,
            timeout: 5000,
        });
    }

    getBackendAuthenticationUrl = (profile: string, redirect_after: string) => {
        const data = new FormData();
        data.append('webid_or_provider', profile);
        data.append('redirect_after', redirect_after);
        return this.client.post(`/auth/request`, data).then(result => {
            return result.data;
        });
    }

    doAuthCallback = (code: string, state: string) => {
        const data = new FormData();
        data.append('code', code);
        data.append('state', state);
        return this.client.post(`/auth/callback`, data).then(result => {
            return result.data;
        });
    }

    addScore = (score: string, profile: string) => {
        const data = {
            score,
            profile,
        };
        return this.client.post(`/add`, data).then(result => {
            return result.data;
        });
    }

    checkUserPermissions = (profile: string) => {
        const profileParams = new URLSearchParams({
            profile
        });
        return this.client.get(`/check_user_perms?${profileParams}`).then(result => {
            return result.data;
        })
    }

}

const ApiInstance = new Api();
export default ApiInstance;
