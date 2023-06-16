import axios from 'axios'
import config from './config'

const { paymentsServiceApiKey } = config

export interface UserBalance {
  one: string
  usd: string
}

export interface PaymentsUser {
  id: number
  appName: string
  userId: string
  userAddress: string
  createdAt: string
  updatedAt: string
}

export class PaymentsService {
  private readonly serviceUrl: string
  private readonly apiKey: string

  constructor(serviceUrl: string, apiKey: string) {
    this.serviceUrl = serviceUrl
    this.apiKey = apiKey
  }

  public async getUser (userId: string) {
    const { data } = await axios.get<PaymentsUser>(`${this.serviceUrl}/users/id/${userId}`)
    return data
  }

  public async getUserBalance (userId: string) {
    const { data } = await axios.get<UserBalance>(`${this.serviceUrl}/users/balance/${userId}`)
    return data
  }

  public async createUser (userId: string) {
    const { data } = await axios.post<PaymentsUser>(`${this.serviceUrl}/users/create`, {
      userId
    })
    return data
  }

  public async withdrawFunds (userId: string, amountUsd: string) {
    const { data } = await axios.post<PaymentsUser>(`${this.serviceUrl}/users/pay`, {
      userId,
      amountUsd
    }, {
      headers: {
        'x-api-key': paymentsServiceApiKey
      }
    })
    return data
  }

  public async convertUsdToOne (amount: string) {
    const { data: oneRate } = await axios.get<string>(`${this.serviceUrl}/web3/tokenPrice/harmony`)
    return (+amount * Math.pow(10, 18)) / +oneRate;
  }
}
