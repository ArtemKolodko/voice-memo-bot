import axios from 'axios'

export interface GPT4Choice {
  text: string
  index: number
  logprobs: null
  finish_reason: string
}

export interface GPT4SummarizationResponse {
  id: string
  object: string
  created: number
  model: string
  choices: GPT4Choice[]
}

export class GPT4 {
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  public async getSummarization (text: string) {
    const preparedText = text.replaceAll(/Speaker: S[0-9]\n/gi, '')
    const url = `https://api.openai.com/v1/completions`
    const { data } = await axios.post<GPT4SummarizationResponse>(url, {
      model: 'text-davinci-003',
      prompt: `Create a short 8-sentence summary from the following text: ${preparedText}`,
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 1,
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
    })

    return data.choices.length > 0
      ? data.choices[0].text
      : ''
  }
}
