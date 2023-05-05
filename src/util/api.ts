import axios, {AxiosInstance} from 'axios';

class Api {
    private client: AxiosInstance;
    constructor() {
        this.client = axios.create({
            baseURL: process.env.REACT_APP_API_URL,
            timeout: 5000,
        });
    }

    addScore = (score: string, profile: string) => {
        const data = {
            score,
            profile,
        }
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
