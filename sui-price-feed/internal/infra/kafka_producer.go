package infra

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/IBM/sarama"
	"github.com/getnimbus/ultrago/u_logger"
	jsoniter "github.com/json-iterator/go"

	"sui-price-feed/internal/conf"
)

func NewKafkaSyncProducer(ctx context.Context) (KafkaSyncProducer, func(), error) {
	ctx, logger := u_logger.GetLogger(ctx)

	// For the data collector, we are looking for strong consistency semantics.
	// Because we don't change the flush settings, sarama will try to produce messages
	// as fast as possible to keep latency low.
	brokers := strings.Split(conf.Config.KafkaBrokers, ",")
	if len(brokers) == 0 {
		return nil, nil, fmt.Errorf("missing env POSTBACK_KAFKA_BROKERS")
	}

	kafkaConfig := sarama.NewConfig()
	kafkaConfig.Version = sarama.DefaultVersion
	kafkaConfig.Producer.Compression = sarama.CompressionSnappy // sarama.CompressionNone
	kafkaConfig.Producer.Partitioner = sarama.NewHashPartitioner
	kafkaConfig.Producer.RequiredAcks = sarama.WaitForAll
	kafkaConfig.Producer.Retry.Max = 10
	kafkaConfig.Producer.Return.Successes = true
	kafkaConfig.Producer.Return.Errors = true
	kafkaConfig.Producer.MaxMessageBytes = 20971520 // 20MB
	// for authentication in prod
	if conf.Config.KafkaUsername != "" && conf.Config.KafkaPassword != "" {
		kafkaConfig.Net.SASL.Enable = true
		kafkaConfig.Net.SASL.User = conf.Config.KafkaUsername
		kafkaConfig.Net.SASL.Password = conf.Config.KafkaPassword
		kafkaConfig.Net.SASL.Handshake = true
		kafkaConfig.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
		kafkaConfig.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		tlsConfig := tls.Config{}
		kafkaConfig.Net.TLS.Enable = true
		kafkaConfig.Net.TLS.Config = &tlsConfig
	}

	logger.Info("[KafkaSyncProducer] start sync producer")
	producer, err := sarama.NewSyncProducer(brokers, kafkaConfig)
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		if err := producer.Close(); err != nil {
			logger.Errorf("[KafkaSyncProducer] close sync producer failed: %v", err)
		}
		logger.Info("[KafkaSyncProducer] close sync producer")
	}

	return &kafkaSyncProducer{
		producer: producer,
	}, cleanup, nil
}

func NewKafkaAsyncProducer(ctx context.Context) (KafkaAsyncProducer, func(), error) {
	ctx, logger := u_logger.GetLogger(ctx)

	// For the access log, we are looking for AP semantics, with high throughput.
	// By creating batches of compressed messages, we reduce network I/O at a cost of more latency.
	brokers := strings.Split(conf.Config.KafkaBrokers, ",")
	if len(brokers) == 0 {
		return nil, nil, fmt.Errorf("missing env POSTBACK_KAFKA_BROKERS")
	}

	kafkaConfig := sarama.NewConfig()
	kafkaConfig.Version = sarama.DefaultVersion
	kafkaConfig.Producer.Compression = sarama.CompressionSnappy // sarama.CompressionNone
	kafkaConfig.Producer.Partitioner = sarama.NewHashPartitioner
	kafkaConfig.Producer.RequiredAcks = sarama.WaitForLocal // only wait for the leader to ack
	kafkaConfig.Producer.Return.Successes = true
	kafkaConfig.Producer.Return.Errors = true
	kafkaConfig.Producer.MaxMessageBytes = 20971520               // 20MB
	kafkaConfig.Producer.Flush.Frequency = 500 * time.Millisecond // flush batches every 500ms
	// for authentication in prod
	if conf.Config.KafkaUsername != "" && conf.Config.KafkaPassword != "" {
		kafkaConfig.Net.SASL.Enable = true
		kafkaConfig.Net.SASL.User = conf.Config.KafkaUsername
		kafkaConfig.Net.SASL.Password = conf.Config.KafkaPassword
		kafkaConfig.Net.SASL.Handshake = true
		kafkaConfig.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
		kafkaConfig.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
		tlsConfig := tls.Config{}
		kafkaConfig.Net.TLS.Enable = true
		kafkaConfig.Net.TLS.Config = &tlsConfig
	}

	logger.Info("[KafkaAsyncProducer] start async producer")
	producer, err := sarama.NewAsyncProducer(brokers, kafkaConfig)
	if err != nil {
		return nil, nil, err
	}

	cleanup := func() {
		if err := producer.Close(); err != nil {
			logger.Errorf("[KafkaAsyncProducer] close async producer failed: %v", err)
		}
		logger.Info("[KafkaAsyncProducer] close async producer")
	}

	// We will just log to STDOUT if we're not able to produce messages.
	// Note: messages will only be returned here after all retry attempts are exhausted.
	go func() {
		for err := range producer.Errors() {
			logger.Warnf("[KafkaAsyncProducer] failed to write to topic:", err)
		}
	}()

	return &kafkaAsyncProducer{
		producer: producer,
	}, cleanup, nil
}

func NewKafkaTxProducer(ctx context.Context) (KafkaTxProducer, func(), error) {
	ctx, logger := u_logger.GetLogger(ctx)

	brokers := strings.Split(conf.Config.KafkaBrokers, ",")
	if len(brokers) == 0 {
		return nil, nil, fmt.Errorf("missing env POSTBACK_KAFKA_BROKERS")
	}

	logger.Info("[KafkaTxProducer] start tx producer")
	producer := newProducerProvider(brokers, func() *sarama.Config {
		kafkaConfig := sarama.NewConfig()
		kafkaConfig.Version = sarama.DefaultVersion
		kafkaConfig.Producer.Idempotent = true
		kafkaConfig.Producer.Return.Errors = false
		kafkaConfig.Producer.Compression = sarama.CompressionSnappy // sarama.CompressionNone
		kafkaConfig.Producer.Partitioner = sarama.NewHashPartitioner
		kafkaConfig.Producer.RequiredAcks = sarama.WaitForAll
		kafkaConfig.Producer.MaxMessageBytes = 20971520 // 20MB
		kafkaConfig.Producer.Transaction.Retry.Backoff = 10
		kafkaConfig.Producer.Transaction.ID = "txn_nimbus_eth_producer"
		kafkaConfig.Net.MaxOpenRequests = 1
		// for authentication in prod
		if conf.Config.KafkaUsername != "" && conf.Config.KafkaPassword != "" {
			kafkaConfig.Net.SASL.Enable = true
			kafkaConfig.Net.SASL.User = conf.Config.KafkaUsername
			kafkaConfig.Net.SASL.Password = conf.Config.KafkaPassword
			kafkaConfig.Net.SASL.Handshake = true
			kafkaConfig.Net.SASL.SCRAMClientGeneratorFunc = func() sarama.SCRAMClient { return &XDGSCRAMClient{HashGeneratorFcn: SHA256} }
			kafkaConfig.Net.SASL.Mechanism = sarama.SASLTypeSCRAMSHA256
			tlsConfig := tls.Config{}
			kafkaConfig.Net.TLS.Enable = true
			kafkaConfig.Net.TLS.Config = &tlsConfig
		}

		return kafkaConfig
	})

	cleanup := func() {
		producer.clear()
		logger.Info("[KafkaTxProducer] close tx producer")
	}

	return producer, cleanup, nil
}

type KafkaSyncProducer interface {
	SendJson(ctx context.Context, topic string, msg KafkaMsg) error
}

type KafkaAsyncProducer interface {
	SendJson(ctx context.Context, topic string, msg KafkaMsg) error
}

type KafkaTxProducer interface {
	SendJson(ctx context.Context, data map[string][]KafkaMsg) error
}

type KafkaMsg interface {
	PartitionKey() string
}

type kafkaSyncProducer struct {
	producer sarama.SyncProducer
}

func (p *kafkaSyncProducer) SendJson(ctx context.Context, topic string, msg KafkaMsg) error {
	value, err := jsoniter.Marshal(msg)
	if err != nil {
		return fmt.Errorf("[%s] Marshal msg %s failed: %v", topic, msg.PartitionKey(), err)
	}

	kkMsg := &sarama.ProducerMessage{
		Topic:     topic,
		Key:       sarama.StringEncoder(msg.PartitionKey()),
		Value:     sarama.ByteEncoder(value),
		Timestamp: time.Now(),
	}

	_, logger := u_logger.GetLogger(ctx)
	partition, offset, err := p.producer.SendMessage(kkMsg)
	if err != nil {
		logger.Errorf("[KafkaSyncProducer] push msg %s to topic=%s partition=%d offset=%d failed: %v", kkMsg.Key, kkMsg.Topic, partition, offset, err)
		return err
	} else {
		logger.Infof("[KafkaSyncProducer] push msg %s to topic=%s partition=%d offset=%d success", kkMsg.Key, kkMsg.Topic, partition, offset)
		return nil
	}
}

type kafkaAsyncProducer struct {
	producer sarama.AsyncProducer
}

func (p *kafkaAsyncProducer) SendJson(ctx context.Context, topic string, msg KafkaMsg) error {
	value, err := jsoniter.Marshal(msg)
	if err != nil {
		return fmt.Errorf("[%s] Marshal msg %s failed: %v", topic, msg.PartitionKey(), err)
	}

	kkMsg := &sarama.ProducerMessage{
		Topic:     topic,
		Key:       sarama.StringEncoder(msg.PartitionKey()),
		Value:     sarama.ByteEncoder(value),
		Timestamp: time.Now(),
	}

	_, logger := u_logger.GetLogger(ctx)
	p.producer.Input() <- kkMsg
	logger.Infof("[KafkaAsyncProducer] push msg %s to topic=%s", kkMsg.Key, kkMsg.Topic)
	return nil
}

type kafkaTxProducer struct {
	transactionIdGenerator int64
	producersLock          sync.Mutex
	producers              []sarama.AsyncProducer
	producerProvider       func() sarama.AsyncProducer
}

func newProducerProvider(brokers []string, producerConfigurationProvider func() *sarama.Config) *kafkaTxProducer {
	provider := &kafkaTxProducer{}
	provider.producerProvider = func() sarama.AsyncProducer {
		kafkaConfig := producerConfigurationProvider()
		suffix := provider.transactionIdGenerator
		// Append transactionIdGenerator to current kafkaConfig.Producer.Transaction.ID to ensure transaction-id uniqueness.
		if kafkaConfig.Producer.Transaction.ID != "" {
			provider.transactionIdGenerator++
			kafkaConfig.Producer.Transaction.ID = kafkaConfig.Producer.Transaction.ID + "-" + fmt.Sprint(suffix)
		}
		producer, err := sarama.NewAsyncProducer(brokers, kafkaConfig)
		if err != nil {
			return nil
		}
		return producer
	}
	return provider
}

func (p *kafkaTxProducer) borrow() (producer sarama.AsyncProducer) {
	p.producersLock.Lock()
	defer p.producersLock.Unlock()

	if len(p.producers) == 0 {
		for {
			producer = p.producerProvider()
			if producer != nil {
				return
			}
		}
	}

	index := len(p.producers) - 1
	producer = p.producers[index]
	p.producers = p.producers[:index]
	return
}

func (p *kafkaTxProducer) release(producer sarama.AsyncProducer) {
	p.producersLock.Lock()
	defer p.producersLock.Unlock()

	// If released producer is erroneous close it and don't return it to the producer pool.
	if producer.TxnStatus()&sarama.ProducerTxnFlagInError != 0 {
		// Try to close it
		_ = producer.Close()
		return
	}
	p.producers = append(p.producers, producer)
}

func (p *kafkaTxProducer) clear() {
	p.producersLock.Lock()
	defer p.producersLock.Unlock()

	for _, producer := range p.producers {
		producer.Close()
	}
	p.producers = p.producers[:0]
}

// TODO: test produce messages in transaction later
// https://viblo.asia/p/008-kafka-producer-transaction-va-delivery-semantics-voi-java-maGK76GO5j2
func (p *kafkaTxProducer) SendJson(ctx context.Context, data map[string][]KafkaMsg) error {
	if len(data) == 0 {
		return nil
	}

	var kkMsgs = make([]*sarama.ProducerMessage, 0)
	for topic, msgs := range data {
		for _, msg := range msgs {
			value, err := jsoniter.Marshal(msg)
			if err != nil {
				return fmt.Errorf("[%s] Marshal msg %s failed: %v", topic, msg.PartitionKey(), err)
			}
			kkMsgs = append(kkMsgs, &sarama.ProducerMessage{
				Topic:     topic,
				Key:       sarama.StringEncoder(msg.PartitionKey()),
				Value:     sarama.ByteEncoder(value),
				Timestamp: time.Now(),
			})
		}
	}

	_, logger := u_logger.GetLogger(ctx)
	producer := p.borrow()
	defer p.release(producer)

	// Start kafka transaction
	if err := producer.BeginTxn(); err != nil {
		logger.Errorf("[KafkaTxProducer] unable to start txn %v", err)
		return err
	}

	// Produce some records in transaction
	for _, kkMsg := range kkMsgs {
		producer.Input() <- kkMsg
	}

	// commit transaction
	if err := producer.CommitTxn(); err != nil {
		logger.Errorf("[KafkaTxProducer] unable to commit txn %v", err)
		for {
			if producer.TxnStatus()&sarama.ProducerTxnFlagFatalError != 0 {
				// fatal error. need to recreate producer.
				logger.Errorf("[KafkaTxProducer] producer is in a fatal state, need to recreate it")
				break
			}
			// If producer is in abortable state, try to abort current transaction.
			if producer.TxnStatus()&sarama.ProducerTxnFlagAbortableError != 0 {
				if err := producer.AbortTxn(); err != nil {
					// If an error occurred just retry it.
					logger.Errorf("[KafkaTxProducer] unable to abort transaction: %v", err)
					continue
				}
				break
			}
			// if not you can retry
			err = producer.CommitTxn()
			if err != nil {
				logger.Errorf("[KafkaTxProducer] unable to commit txn %v", err)
				continue
			}
		}
		return err
	}

	return nil
}
