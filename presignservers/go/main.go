package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/credentials"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

const (
	authHeaderPrefix  = "AWS4-HMAC-SHA256"
	timeFormat        = "20060102T150405Z"
	shortTimeFormat   = "20060102"
	awsV4Request      = "aws4_request"
	emptyStringSHA256 = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
)

// var db = make(map[string]string)

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func setupRouter(svc *s3.S3) *gin.Engine {
	r := gin.Default()

	r.Use(CORS())

	r.GET("/sign_auth", func(c *gin.Context) {
		region := c.Query("region")
		shortDate := c.Query("date")
		scope := c.Query("scope")
		stringToSign := c.Query("tosign")
		service := c.Query("service")

		if region == "" || shortDate == "" || scope == "" || stringToSign == "" || service == "" {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "missing required parameters"})
			return
		}
		t, err := time.Parse(shortTimeFormat, shortDate)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "failed to parse date " + err.Error()})
			return
		}
		log.Debug().Msgf("date: %s, regionName: %s, serviceName: %s, tosign: %s", shortDate, region, service, stringToSign)

		creds, _ := svc.Config.Credentials.Get()
		signature := buildSignature(region, service, creds.SecretAccessKey, t, stringToSign)

		c.Data(http.StatusOK, "application/octet-stream", []byte(signature))
	})

	return r
}

func buildSignature(region string, serviceName string, secretKey string, t time.Time, stringToSign string) string {
	creds := deriveSigningKey(region, serviceName, secretKey, t)
	signature := hmacSHA256(creds, []byte(stringToSign))
	return hex.EncodeToString(signature)
}

func deriveSigningKey(region, service, secretKey string, dt time.Time) []byte {
	kDate := hmacSHA256([]byte("AWS4"+secretKey), []byte(formatShortTime(dt)))
	kRegion := hmacSHA256(kDate, []byte(region))
	kService := hmacSHA256(kRegion, []byte(service))
	signingKey := hmacSHA256(kService, []byte(awsV4Request))
	return signingKey
}

func hashSHA256(data []byte) []byte {
	hash := sha256.New()
	hash.Write(data)
	return hash.Sum(nil)
}

func formatShortTime(dt time.Time) string {
	return dt.UTC().Format(shortTimeFormat)
}

func hmacSHA256(key []byte, data []byte) []byte {
	hash := hmac.New(sha256.New, key)
	hash.Write(data)
	return hash.Sum(nil)
}

func main() {
	err := godotenv.Load("../.env")
	awsSecret := os.Getenv("AWS_SECRET")
	awsKey := os.Getenv("AWS_KEY")
	if err != nil {
		log.Fatal().Msgf("Error loading .env file", err)
	}
	if awsSecret == "" || awsKey == "" {
		log.Fatal().Msg("AWS_SECRET or AWS_KEY is empty")
	}

	// init AWS SDK
	sess := session.Must(session.NewSession(&aws.Config{
		Credentials: credentials.NewStaticCredentials(awsKey, awsSecret, ""),
	}))
	svc := s3.New(sess)

	r := setupRouter(svc)
	// Listen and Server in 0.0.0.0:8080
	r.Run(":8080")
}
