import axios from 'axios'

interface SummarizationResponse {
  meta: {
    id: string
    node: string
    ms: string
  },
  data: {
    output: string
  }
  tokens: number
}

export class Kagi {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  public async getSummarization (audioUrl: string) {
    const url = `https://kagi.com/api/v0/summarize?url=${audioUrl}`
    const { data } = await axios.get<SummarizationResponse>(url, {
      headers: {
        'Authorization': `Bot ${this.apiKey}`
      }
    })
    return data.data.output
  }
}
