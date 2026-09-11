require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 8027;

// API Keys dengan fallback
const API_KEYS = [
  process.env.POLLINATIONS_APIKEY1,
  process.env.POLLINATIONS_APIKEY2
].filter(Boolean);

let currentKeyIndex = 0;

// Fungsi untuk mendapatkan API key dengan fallback
function getApiKey() {
  if (API_KEYS.length === 0) {
    throw new Error('No API keys configured');
  }
  return API_KEYS[currentKeyIndex];
}

// Fungsi untuk switch ke API key berikutnya
function switchToNextKey() {
  currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
  console.log(`Switched to API key ${currentKeyIndex + 1}`);
}

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  // Log request ke /api/* dan /v1/* kecuali endpoint stats
  const shouldLog = (req.path.startsWith('/api/') || req.path.startsWith('/v1/')) 
                    && !req.path.startsWith('/api/stats/');
  
  if (shouldLog) {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.socket.remoteAddress;
    const clientIp = ip.split(',')[0].trim();
    
    // Format waktu: Mon Sep 7 11:51 WITA
    const now = new Date();
    const options = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Makassar',
      timeZoneName: 'short'
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    
    const weekday = parts.find(p => p.type === 'weekday')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const timeZone = parts.find(p => p.type === 'timeZoneName')?.value;
    
    const timestamp = `${weekday} ${month} ${day} ${hour}:${minute} ${timeZone}`;
    
    const logEntry = `[${timestamp}] ${clientIp} Request to ${req.path} [${req.method}]\n`;
    
    fs.appendFile('request_log.txt', logEntry, (err) => {
      if (err) console.error('Error writing to request_log.txt:', err);
    });
  }
  
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname)));

// Swagger configuration
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'ExodusAPI - Free AI API',
    version: '1.0.0',
    description: 'OpenAI-compatible REST API untuk mengakses AI models gratis untuk developer. Mendukung OpenAI SDK dan format compatible.',
    contact: {
      name: 'FikriDev',
      url: 'https://fikridev.me'
    }
  },
  servers: [
    {
      url: `https://api.fikridev.me`,
      description: 'Main server'
    }
  ],
  tags: [
    { name: 'OpenAI Compatible', description: 'OpenAI-compatible endpoints (v1)' },
    { name: 'Text', description: 'Text generation endpoints (Legacy)' },
    { name: 'Image', description: 'Image generation endpoints (Legacy)' },
    { name: 'Audio', description: 'Audio transcription endpoints' }
  ],
  components: {
    schemas: {
      ChatCompletionRequest: {
        type: 'object',
        required: ['model', 'messages'],
        properties: {
          model: {
            type: 'string',
            example: 'openai',
            description: 'Model ID to use'
          },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: {
                  type: 'string',
                  enum: ['user', 'assistant', 'system'],
                  example: 'user'
                },
                content: {
                  type: 'string',
                  example: 'Hello!'
                }
              }
            }
          },
          temperature: {
            type: 'number',
            minimum: 0,
            maximum: 2,
            example: 0.7
          },
          top_p: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            example: 1
          },
          max_tokens: {
            type: 'integer',
            example: 1000
          },
          stream: {
            type: 'boolean',
            example: false
          },
          stop: {
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ]
          }
        }
      },
      ChatCompletionResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'chatcmpl-exodus-123456'
          },
          object: {
            type: 'string',
            example: 'chat.completion'
          },
          created: {
            type: 'integer',
            example: 1750000000
          },
          model: {
            type: 'string',
            example: 'openai'
          },
          choices: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: {
                  type: 'integer',
                  example: 0
                },
                message: {
                  type: 'object',
                  properties: {
                    role: {
                      type: 'string',
                      example: 'assistant'
                    },
                    content: {
                      type: 'string',
                      example: 'Hello! How can I help you today?'
                    }
                  }
                },
                finish_reason: {
                  type: 'string',
                  example: 'stop'
                }
              }
            }
          },
          usage: {
            type: 'object',
            properties: {
              prompt_tokens: {
                type: 'integer',
                example: 10
              },
              completion_tokens: {
                type: 'integer',
                example: 20
              },
              total_tokens: {
                type: 'integer',
                example: 30
              }
            }
          }
        }
      },
      ImageGenerationRequest: {
        type: 'object',
        required: ['model', 'prompt'],
        properties: {
          model: {
            type: 'string',
            example: 'flux',
            description: 'Model ID to use for image generation'
          },
          prompt: {
            type: 'string',
            example: 'A cat in space'
          },
          n: {
            type: 'integer',
            minimum: 1,
            maximum: 10,
            example: 1
          },
          size: {
            type: 'string',
            example: '1024x1024'
          },
          response_format: {
            type: 'string',
            enum: ['url', 'b64_json'],
            example: 'url'
          }
        }
      },
      ImageGenerationResponse: {
        type: 'object',
        properties: {
          created: {
            type: 'integer',
            example: 1750000000
          },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  example: 'https://...'
                },
                b64_json: {
                  type: 'string'
                }
              }
            }
          }
        }
      },
      ModelList: {
        type: 'object',
        properties: {
          object: {
            type: 'string',
            example: 'list'
          },
          data: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Model'
            }
          }
        }
      },
      Model: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'openai'
          },
          object: {
            type: 'string',
            example: 'model'
          },
          created: {
            type: 'integer',
            example: 1750000000
          },
          owned_by: {
            type: 'string',
            example: 'exodusapi'
          }
        }
      },
      OpenAIError: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                example: 'Model not found'
              },
              type: {
                type: 'string',
                example: 'invalid_request_error'
              },
              param: {
                type: 'string',
                example: 'model'
              },
              code: {
                type: 'string',
                example: 'model_not_found'
              }
            }
          }
        }
      },
      MessageInput: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: {
                  type: 'string',
                  enum: ['user', 'assistant', 'system'],
                  example: 'user'
                },
                content: {
                  type: 'string',
                  example: 'Hello, how are you?'
                }
              }
            }
          }
        }
      },
      AudioTranscribeInput: {
        type: 'object',
        required: ['audio_url'],
        properties: {
          audio_url: {
            type: 'string',
            format: 'uri',
            example: 'https://example.com/audio.mp3',
            description: 'URL of the audio file to transcribe'
          }
        }
      },
      SuccessResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'boolean',
            example: true
          },
          creator: {
            type: 'string',
            example: 'FikriDev'
          },
          result: {
            type: 'string'
          }
        }
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string'
          }
        }
      }
    }
  },
  paths: {}
};

// Model list dari file markdown
const textModels = [
  { name: 'GPT-5.4 Nano', id: 'openai' },
  { name: 'GPT-5 Nano', id: 'openai-fast' },
  { name: 'Nova Micro', id: 'nova-fast' },
  { name: 'Qwen3 Coder 30B', id: 'qwen-coder' },
  { name: 'Grok 4.20', id: 'grok' },
  { name: 'Qwen3Guard 8B', id: 'qwen-safety' },
  { name: 'MIDIjourney', id: 'midijourney' },
  { name: 'GPT-5.4 Mini', id: 'gpt-5.4-mini' },
  { name: 'NVIDIA Nemotron 3.5 Lightning', id: 'nemotron-3.5-lightning' },
  { name: 'Meta Llama 3.3 70B', id: 'llama' }
];

const imageModels = [
  { name: 'DreamShaper 8 LCM', id: 'dreamshaper' },
  { name: 'FLUX.1 Schnell', id: 'flux' },
  { name: 'GPT Image', id: 'gptimage' }
];

// Helper function untuk generate unique ID
function generateId(prefix = 'chatcmpl-exodus') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Helper function untuk mendapatkan model by ID
function findModelById(modelId) {
  const textModel = textModels.find(m => m.id === modelId);
  if (textModel) return { ...textModel, type: 'text' };
  
  const imageModel = imageModels.find(m => m.id === modelId);
  if (imageModel) return { ...imageModel, type: 'image' };
  
  return null;
}

// Helper function untuk OpenAI error response
function openaiError(message, type = 'invalid_request_error', param = null, code = null, statusCode = 400) {
  return {
    statusCode,
    body: {
      error: {
        message,
        type,
        param,
        code
      }
    }
  };
}

// ============================================
// OPENAI-COMPATIBLE API SWAGGER PATHS
// ============================================

// POST /v1/chat/completions
swaggerDocument.paths['/v1/chat/completions'] = {
  post: {
    tags: ['OpenAI Compatible'],
    summary: 'Chat Completions (OpenAI-compatible)',
    description: 'Create a chat completion using OpenAI-compatible format. Works with OpenAI SDK.',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/ChatCompletionRequest' },
          examples: {
            basic: {
              summary: 'Basic chat completion',
              value: {
                model: 'openai',
                messages: [
                  { role: 'user', content: 'Hello!' }
                ]
              }
            },
            withSystem: {
              summary: 'With system message',
              value: {
                model: 'openai',
                messages: [
                  { role: 'system', content: 'You are a helpful assistant.' },
                  { role: 'user', content: 'Hello!' }
                ]
              }
            }
          }
        }
      }
    },
    responses: {
      200: {
        description: 'Successful completion',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ChatCompletionResponse' }
          }
        }
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OpenAIError' }
          }
        }
      },
      404: {
        description: 'Model Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OpenAIError' }
          }
        }
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OpenAIError' }
          }
        }
      }
    }
  }
};

// GET /v1/models
swaggerDocument.paths['/v1/models'] = {
  get: {
    tags: ['OpenAI Compatible'],
    summary: 'List Models (OpenAI-compatible)',
    description: 'List all available models in OpenAI-compatible format',
    responses: {
      200: {
        description: 'List of models',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ModelList' }
          }
        }
      }
    }
  }
};

// GET /v1/models/:model
swaggerDocument.paths['/v1/models/{model}'] = {
  get: {
    tags: ['OpenAI Compatible'],
    summary: 'Retrieve Model (OpenAI-compatible)',
    description: 'Get information about a specific model',
    parameters: [
      {
        name: 'model',
        in: 'path',
        required: true,
        schema: {
          type: 'string',
          example: 'openai'
        },
        description: 'Model ID'
      }
    ],
    responses: {
      200: {
        description: 'Model information',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Model' }
          }
        }
      },
      404: {
        description: 'Model Not Found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/OpenAIError' }
          }
        }
      }
    }
  }
};

// Generate Swagger paths untuk Text models (Legacy)
textModels.forEach(model => {
  const routeName = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  swaggerDocument.paths[`/api/text/${routeName}`] = {
    post: {
      tags: ['Text'],
      summary: model.name,  // Menggunakan nama asli model
      description: `Generate text using ${model.name} model (ID: ${model.id})`,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/MessageInput' }
          }
        }
      },
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        400: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  };
});

// Generate Swagger paths untuk Image models (Legacy)
imageModels.forEach(model => {
  const routeName = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  swaggerDocument.paths[`/api/image/${routeName}`] = {
    get: {
      tags: ['Image'],
      summary: model.name,  // Menggunakan nama asli model
      description: `Generate image using ${model.name} model (ID: ${model.id})`,
      parameters: [
        {
          name: 'prompt',
          in: 'query',
          required: true,
          schema: {
            type: 'string',
            example: 'a cat in space'
          },
          description: 'Text prompt for image generation'
        }
      ],
      responses: {
        200: {
          description: 'Generated image',
          content: {
            'image/png': {
              schema: {
                type: 'string',
                format: 'binary'
              }
            },
            'image/jpeg': {
              schema: {
                type: 'string',
                format: 'binary'
              }
            }
          }
        },
        400: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        },
        500: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    }
  };
});

// Swagger path untuk Audio Transcription
swaggerDocument.paths['/api/audio/transcribe'] = {
  post: {
    tags: ['Audio'],
    summary: 'Transcribe Audio (Whisper Large V3)',
    description: 'Transcribe audio from URL using OpenAI Whisper Large V3 model. Supported formats: mp3, mp4, mpeg, mpga, m4a, wav, webm',
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/AudioTranscribeInput' }
        }
      }
    },
    responses: {
      200: {
        description: 'Transcription successful',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SuccessResponse' }
          }
        }
      },
      400: {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      },
      500: {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    }
  }
};

// Swagger UI setup
app.get('/swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true
}));

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  explorer: true
}));

// ============================================
// OPENAI-COMPATIBLE API ROUTES
// ============================================

// GET /v1/models - List all models
app.get('/v1/models', (req, res) => {
  try {
    const allModels = [
      ...textModels.map(m => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'exodusapi'
      })),
      ...imageModels.map(m => ({
        id: m.id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'exodusapi'
      }))
    ];

    res.json({
      object: 'list',
      data: allModels
    });
  } catch (error) {
    console.error('Error in /v1/models:', error.message);
    const err = openaiError('Internal server error', 'api_error', null, 'internal_error', 500);
    res.status(err.statusCode).json(err.body);
  }
});

// GET /v1/models/:model - Get specific model
app.get('/v1/models/:model', (req, res) => {
  try {
    const modelId = req.params.model;
    const model = findModelById(modelId);

    if (!model) {
      const err = openaiError(
        `The model '${modelId}' does not exist.`,
        'invalid_request_error',
        'model',
        'model_not_found',
        404
      );
      return res.status(err.statusCode).json(err.body);
    }

    res.json({
      id: model.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'exodusapi'
    });
  } catch (error) {
    console.error('Error in /v1/models/:model:', error.message);
    const err = openaiError('Internal server error', 'api_error', null, 'internal_error', 500);
    res.status(err.statusCode).json(err.body);
  }
});

// POST /v1/chat/completions - OpenAI-compatible chat completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model: modelId, messages, temperature, top_p, max_tokens, stream, stop } = req.body;

    // Validasi model
    if (!modelId) {
      const err = openaiError(
        'Missing required parameter: model',
        'invalid_request_error',
        'model',
        'missing_parameter',
        400
      );
      return res.status(err.statusCode).json(err.body);
    }

    // Validasi messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      const err = openaiError(
        'Missing or invalid required parameter: messages',
        'invalid_request_error',
        'messages',
        'invalid_parameter',
        400
      );
      return res.status(err.statusCode).json(err.body);
    }

    // Cek apakah model ada
    const model = findModelById(modelId);
    if (!model) {
      const err = openaiError(
        `The model '${modelId}' does not exist.`,
        'invalid_request_error',
        'model',
        'model_not_found',
        404
      );
      return res.status(err.statusCode).json(err.body);
    }

    // Validasi bahwa model adalah text model
    if (model.type !== 'text') {
      const err = openaiError(
        `The model '${modelId}' is not a text model.`,
        'invalid_request_error',
        'model',
        'invalid_model_type',
        400
      );
      return res.status(err.statusCode).json(err.body);
    }

    // Handle streaming jika diminta
    if (stream === true) {
      // Set headers untuk SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        // Request ke provider
        const content = await requestToPollinations(model.id, messages);
        
        const completionId = generateId('chatcmpl-exodus');
        const created = Math.floor(Date.now() / 1000);

        // Kirim chunks
        const words = content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = {
            id: completionId,
            object: 'chat.completion.chunk',
            created: created,
            model: model.id,
            choices: [{
              index: 0,
              delta: i === 0 ? { role: 'assistant', content: words[i] + ' ' } : { content: words[i] + ' ' },
              finish_reason: null
            }]
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        // Final chunk
        const finalChunk = {
          id: completionId,
          object: 'chat.completion.chunk',
          created: created,
          model: model.id,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        };
        res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();

      } catch (error) {
        console.error('Error in streaming:', error.message);
        const errorChunk = {
          error: {
            message: error.message,
            type: 'api_error',
            code: 'internal_error'
          }
        };
        res.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        res.end();
      }
      return;
    }

    // Non-streaming response
    const content = await requestToPollinations(model.id, messages);

    const response = {
      id: generateId('chatcmpl-exodus'),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model.id,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: content
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error in /v1/chat/completions:', error.message);
    
    // Log error
    const errorLog = `[${new Date().toISOString()}] /v1/chat/completions - ${error.stack || error.message}\n`;
    fs.appendFile('error.txt', errorLog, () => {});

    const err = openaiError(
      error.message || 'Internal server error',
      'api_error',
      null,
      'internal_error',
      500
    );
    res.status(err.statusCode).json(err.body);
  }
});

// ============================================
// LEGACY API ROUTES
// ============================================

// Handler untuk request ke Pollinations dengan fallback
async function requestToPollinations(modelId, messages, retryCount = 0) {
  try {
    const apiKey = getApiKey();
    
    const payload = {
      model: modelId,
      messages
    };

    const response = await axios.post(
      'https://gen.pollinations.ai/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    return response.data?.choices?.[0]?.message?.content || '';

  } catch (error) {
    const errorMessage = error.response?.data?.message || error.message;
    
    // Jika error karena API key dan masih ada key lain, coba key berikutnya
    if (error.response?.status === 401 || error.response?.status === 403) {
      if (API_KEYS.length > 1 && retryCount < API_KEYS.length) {
        console.log(`API Key ${currentKeyIndex + 1} failed, trying next key...`);
        switchToNextKey();
        return await requestToPollinations(modelId, messages, retryCount + 1);
      }
    }

    // Log error ke file
    const errorLog = `[${new Date().toISOString()}] Model: ${modelId} - ${error.stack || errorMessage}\n`;
    fs.appendFile('error.txt', errorLog, () => {});

    throw new Error(errorMessage);
  }
}

// Generate routes untuk Text models
textModels.forEach(model => {
  const routeName = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  
  app.post(`/api/text/${routeName}`, async (req, res) => {
    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({
          error: 'Invalid request format. "messages" harus berupa array.'
        });
      }

      const result = await requestToPollinations(model.id, messages);

      res.json({
        status: true,
        creator: 'FikriDev',
        result
      });

    } catch (error) {
      console.error(`Error in ${routeName}:`, error.message);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
});

// Generate routes untuk Image models (Legacy)
imageModels.forEach(model => {
  const routeName = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  app.get(`/api/image/${routeName}`, async (req, res) => {
    try {
      const { prompt } = req.query;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          error: 'Invalid request format. "prompt" query parameter is required.'
        });
      }

      const encodedPrompt = encodeURIComponent(prompt);
      const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?model=${model.id}`;

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'ExodusAPI/1.0'
        }
      });

      const contentType = response.headers['content-type'] || 'image/png';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Creator', 'FikriDev');

      res.send(response.data);

    } catch (error) {
      console.error(`Error in ${routeName}:`, error.message);

      const errorLog =
        `[${new Date().toISOString()}] Image Model: ${model.id} - ${error.stack || error.message}\n`;

      fs.appendFile('error.txt', errorLog, () => {});

      res.status(500).json({
        error: 'Internal Server Error'
      });
    }
  });
});

// Route untuk Audio Transcription
app.post('/api/audio/transcribe', async (req, res) => {
  try {
    const { audio_url } = req.body;

    if (!audio_url || typeof audio_url !== 'string') {
      return res.status(400).json({
        error: 'Invalid request format. "audio_url" is required.'
      });
    }

    // Validasi URL
    try {
      new URL(audio_url);
    } catch (e) {
      return res.status(400).json({
        error: 'Invalid audio URL format.'
      });
    }

    // Download audio dari URL
    console.log('Downloading audio from:', audio_url);
    const audioResponse = await axios.get(audio_url, {
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'FikriDev-API/1.0'
      }
    });

    // Dapatkan nama file dari URL atau gunakan default
    const urlParts = audio_url.split('/');
    const fileName = urlParts[urlParts.length - 1] || 'audio.mp3';

    // Buat FormData untuk upload ke Pollinations
    const formData = new FormData();
    formData.append('file', audioResponse.data, {
      filename: fileName,
      contentType: audioResponse.headers['content-type'] || 'audio/mpeg'
    });
    formData.append('model', 'openai/whisper-large-v3');

    // Get API key
    const apiKey = getApiKey();

    console.log('Sending to Pollinations for transcription...');
    
    // Request transcription ke Pollinations
    const transcriptionResponse = await axios.post(
      'https://gen.pollinations.ai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 120000 // 2 minutes timeout untuk transcription
      }
    );

    const transcriptionText = transcriptionResponse.data?.text || '';

    res.json({
      status: true,
      creator: 'FikriDev',
      result: transcriptionText
    });

  } catch (error) {
    console.error('Error in audio transcription:', error.message);
    
    // Log error ke file
    const errorLog = `[${new Date().toISOString()}] Audio Transcription - ${error.stack || error.message}\n`;
    fs.appendFile('error.txt', errorLog, () => {});

    // Handle specific errors
    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({ error: 'API authentication failed' });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(500).json({ error: 'Request timeout' });
    }

    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Route untuk serving index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint untuk mendapatkan total request count
app.get('/api/stats/total-requests', (req, res) => {
  try {
    const logFile = path.join(__dirname, 'request_log.txt');
    
    // Cek apakah file ada
    if (!fs.existsSync(logFile)) {
      return res.json({ total: 0 });
    }

    // Baca file dan hitung jumlah baris
    const fileContent = fs.readFileSync(logFile, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim() !== '');
    const totalRequests = lines.length;

    res.json({ total: totalRequests });
  } catch (error) {
    console.error('Error reading request log:', error);
    res.json({ total: 0 });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`╔═══════════════════════════════════════════════════╗`);
  console.log(`║        ExodusAPI - OpenAI Compatible              ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║   Base URL: https://api.fikridev.me               ║`);
  console.log(`║   Swagger: https://api.fikridev.me/api-docs       ║`);
  console.log(`║   Creator: FikriDev                               ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║   OpenAI-Compatible Endpoints:                    ║`);
  console.log(`║   • POST /v1/chat/completions                     ║`);
  console.log(`║   • GET  /v1/models                               ║`);
  console.log(`║   • GET  /v1/models/:model                        ║`);
  console.log(`╠═══════════════════════════════════════════════════╣`);
  console.log(`║   API Keys loaded: ${API_KEYS.length}                            ║`);
  console.log(`║   Text Models: ${textModels.length}                              ║`);
  console.log(`║   Image Models: ${imageModels.length}                             ║`);
  console.log(`║   Audio Transcription: 1                          ║`);
  console.log(`╚═══════════════════════════════════════════════════╝`);
});
